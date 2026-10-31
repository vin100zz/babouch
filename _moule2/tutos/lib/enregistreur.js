'use strict';

// ── Enregistrement vidéo par le « screencast » de Chrome ───────────────────
// L'enregistreur intégré de Playwright produit une vidéo floue et non
// réglable ; on récupère plutôt chaque image rendue par Chrome (JPEG, à la
// résolution réelle de l'écran), datée, puis ffmpeg les assemble en MP4 à
// cadence fixe : chaque image reste affichée jusqu'à la suivante.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const IPS = 30;

class Enregistreur {
  constructor(page, dossierTemp) {
    this.page = page;
    this.dossier = dossierTemp;
    this.images = [];   // { fichier, t }
  }

  async demarrer() {
    fs.rmSync(this.dossier, { recursive: true, force: true });
    fs.mkdirSync(this.dossier, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.ecritures = [];
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      // Acquittement immédiat (Chrome attend l'accusé avant l'image suivante)
      // et écriture asynchrone : la capture ne doit pas ralentir les gestes.
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      const fichier = path.join(this.dossier, String(this.images.length).padStart(6, '0') + '.jpg');
      this.images.push({ fichier, t: metadata.timestamp });
      this.ecritures.push(fs.promises.writeFile(fichier, Buffer.from(data, 'base64')));
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
  }

  async arreter() {
    this.fin = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast');
    await new Promise(r => setTimeout(r, 200)); // dernières images en vol
    await Promise.all(this.ecritures);
  }

  /** Assemble les images en MP4 (H.264) et extrait une image d'aperçu. */
  async encoder(sortieMp4, { titre, commentaire, apercuA = 0.5 } = {}) {
    if (this.images.length === 0) throw new Error('aucune image enregistrée');
    if (process.env.TUTOS_DEBUG) {
      const t = this.images.map(i => i.t);
      console.log('\n  images : ' + t.length + ', de ' + t[0] + ' à ' + t[t.length - 1] + ', fin ' + this.fin
        + ', écart max ' + Math.max(...t.slice(1).map((v, i) => v - t[i])).toFixed(2) + ' s');
    }
    // Rééchantillonnage à cadence fixe : pour chaque image de la vidéo, la
    // dernière image reçue de Chrome à cet instant (Chrome en envoie jusqu'à
    // ~70 par seconde pendant les animations, aucune quand rien ne bouge).
    const t0 = this.images[0].t;
    const total = Math.max(this.fin, this.images[this.images.length - 1].t) - t0;
    const liste = path.join(this.dossier, 'liste.txt');
    const lignes = [];
    let j = 0;
    for (let k = 0; k <= Math.round(total * IPS); k++) {
      while (j + 1 < this.images.length && this.images[j + 1].t - t0 <= k / IPS) j++;
      lignes.push("file '" + this.images[j].fichier.replace(/\\/g, '/') + "'", 'duration ' + (1 / IPS).toFixed(6));
    }
    // Le démultiplexeur concat ignore la durée de la dernière entrée : on la répète.
    lignes.push(lignes[lignes.length - 2]);
    fs.writeFileSync(liste, lignes.join('\n'));

    fs.mkdirSync(path.dirname(sortieMp4), { recursive: true });
    await executer([
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste,
      '-vf', 'fps=' + IPS + ',scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'stillimage',
      '-movflags', '+faststart',
      '-metadata', 'title=' + (titre || ''), '-metadata', 'comment=' + (commentaire || ''),
      sortieMp4,
    ]);
    await executer([
      '-y', '-loglevel', 'error', '-ss', (total * apercuA).toFixed(2), '-i', sortieMp4,
      '-frames:v', '1', '-q:v', '3', sortieMp4.replace(/\.mp4$/, '.jpg'),
    ]);
    fs.rmSync(this.dossier, { recursive: true, force: true });
    return total;
  }
}

function executer(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error('ffmpeg a échoué (code ' + code + ')'))));
  });
}

module.exports = { Enregistreur };
