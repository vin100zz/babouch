'use strict';

// ── Éditeur de texte riche (contentEditable + execCommand, sans librairie) ──
// Porté fidèlement depuis famille2/src/ui/js/editor.js : ne conserve que
// gras/italique/souligné/lien/sauts de ligne, à l'exclusion de toute mise en
// forme importée par copier-coller (police, taille, couleur…).

const RichText = (function () {

  function _tooltipEl() {
    let tip = document.getElementById('m2-tooltip');
    if (!tip) {
      tip = el('div', 'ct-tooltip');
      tip.id = 'm2-tooltip';
      tip.style.cssText = 'position:fixed;z-index:900;display:none;background:#1e293b;color:#fff;' +
        'font-size:.75rem;padding:4px 8px;border-radius:4px;pointer-events:none;';
      document.body.appendChild(tip);
    }
    return tip;
  }
  function _showLinkTooltip(url, px, py) {
    const tip = _tooltipEl();
    tip.textContent = url;
    tip.style.display = 'block';
    tip.style.left = (px + 14) + 'px';
    tip.style.top = (py + 18) + 'px';
  }
  function _hideLinkTooltip() {
    const tip = document.getElementById('m2-tooltip');
    if (tip) tip.style.display = 'none';
  }

  /** N'autorise que http(s)/mailto/tel ; préfixe https:// si aucun schéma. */
  function _sanitizeUrl(raw) {
    const url = (raw || '').trim();
    if (!url) return null;
    if (/^(https?|mailto|tel):/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
    return 'https://' + url;
  }

  function _openLinkPopup(defaultText, defaultUrl, title, confirmLabel, onConfirm) {
    const overlay = el('div', 'ed-popup-overlay');
    const popup = el('div', 'ed-popup');
    popup.appendChild(txt('div', 'ed-popup__title', title));

    const textInp = document.createElement('input');
    textInp.type = 'text'; textInp.className = 'ed-input'; textInp.placeholder = 'Texte du lien';
    textInp.value = defaultText || '';
    const urlInp = document.createElement('input');
    urlInp.type = 'text'; urlInp.className = 'ed-input'; urlInp.placeholder = 'URL (https://...)';
    urlInp.value = defaultUrl || '';
    popup.appendChild(textInp);
    popup.appendChild(urlInp);

    const errEl = txt('div', 'ed-popup__error', ''); errEl.hidden = true;
    popup.appendChild(errEl);

    const btnRow = el('div', 'ed-popup__btns');
    const btnCreate = el('button', 'ed-btn ed-btn--save');
    btnCreate.type = 'button'; btnCreate.textContent = confirmLabel;
    const btnCancel = el('button', 'ed-btn ed-btn--cancel');
    btnCancel.type = 'button'; btnCancel.textContent = 'Annuler';
    btnCancel.addEventListener('click', () => document.body.removeChild(overlay));

    btnCreate.addEventListener('click', () => {
      const url = _sanitizeUrl(urlInp.value);
      if (!url) { errEl.textContent = 'Saisir une URL valide (http, https, mailto ou tel).'; errEl.hidden = false; urlInp.focus(); return; }
      const text = textInp.value.trim();
      document.body.removeChild(overlay);
      onConfirm(text, url);
    });

    btnRow.appendChild(btnCreate); btnRow.appendChild(btnCancel);
    popup.appendChild(btnRow);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    textInp.focus();
  }

  const _PASTE_BLOCK_TAGS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'blockquote']);

  function _escapePastedText(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _sanitizePastedNode(node) {
    let out = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += _escapePastedText(child.textContent);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const t = child.tagName.toLowerCase();
        if (t === 'script' || t === 'style') return;
        if (t === 'br') { out += '<br>'; return; }
        const inner = _sanitizePastedNode(child);
        if      (t === 'b' || t === 'strong')  out += '<b>' + inner + '</b>';
        else if (t === 'i' || t === 'em')      out += '<i>' + inner + '</i>';
        else if (t === 'u')                    out += '<u>' + inner + '</u>';
        else if (_PASTE_BLOCK_TAGS.has(t))     out += (out ? '<br>' : '') + inner;
        else                                   out += inner;
      }
    });
    return out;
  }

  function _sanitizePastedHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    return _sanitizePastedNode(container);
  }

  function _trimPastedHtml(str) {
    return str.replace(/^(?:<br>|\s)+/i, '').replace(/(?:<br>|\s)+$/i, '');
  }

  function _serializeRichTextInner(node) {
    let out = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent.replace(/​/g, '');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const t = child.tagName.toLowerCase();
        if      (t === 'br')                  out += '<br/>';
        else if (t === 'b' || t === 'strong') out += '<b>' + _serializeRichTextInner(child) + '</b>';
        else if (t === 'i' || t === 'em')     out += '<i>' + _serializeRichTextInner(child) + '</i>';
        else if (t === 'u')                   out += '<u>' + _serializeRichTextInner(child) + '</u>';
        else if (t === 'a') {
          const href = _sanitizeUrl(child.getAttribute('href') || '');
          if (href) {
            const escaped = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            out += '<a href="' + escaped + '" target="_blank" rel="noopener noreferrer">' + _serializeRichTextInner(child) + '</a>';
          } else {
            out += _serializeRichTextInner(child);
          }
        }
        else if (t === 'div' || t === 'p') {
          const inner = _serializeRichTextInner(child);
          out += (out && !out.endsWith('<br/>') ? '<br/>' : '') + inner;
        } else out += _serializeRichTextInner(child);
      }
    });
    return out;
  }

  // Ne retire un <br/> final que tout à la fin, sur le contenu complet du bloc :
  // le faire à chaque niveau de récursion (comme avant) supprimait à tort tout
  // saut de ligne qui atterrissait comme dernier enfant DANS un tag inline
  // (ex: <a>Texte<br/></a><i>suite</i>) — cas fréquent quand le navigateur
  // insère le <br> juste à l'intérieur d'un lien en fin de sélection.
  function _serializeRichText(node) {
    return _serializeRichTextInner(node).replace(/(<br\/>)+$/, '');
  }

  function _insertBr(edDiv) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement('br');
    range.insertNode(br);
    if (br.nextSibling && br.nextSibling.nodeType === Node.TEXT_NODE && br.nextSibling.textContent === '') {
      br.parentNode.removeChild(br.nextSibling);
    }
    if (!br.nextSibling) br.parentNode.insertBefore(document.createTextNode(' '), br.nextSibling);
    range.setStartAfter(br); range.setEndAfter(br);
    sel.removeAllRanges(); sel.addRange(range);
  }

  /**
   * Rend éditable en place un élément déjà rendu (le bloc TEXTE de la page,
   * voir page-editor.js) : saisie, sauts de ligne, collage nettoyé, édition
   * des liens existants. Mute block.html à chaque frappe, puis appelle
   * onChange(). Renvoie une fonction qui désactive l'édition.
   */
  function attach(edDiv, block, onChange) {
    edDiv.innerHTML = (block.html || '').replace(/\t/g, '').replace(/\n/g, '<br>').replace(/<br\/>/gi, '<br>');
    edDiv.contentEditable = 'true'; edDiv.spellcheck = true;
    const sync = () => { block.html = _serializeRichText(edDiv); if (onChange) onChange(); };

    const onInput = () => sync();
    const onKeydown = e => { if (e.key === 'Enter') { e.preventDefault(); _insertBr(edDiv); sync(); } };
    const onPaste = e => {
      e.preventDefault();
      const cd = e.clipboardData || window.clipboardData;
      if (!cd) return;
      const html = cd.getData('text/html');
      const cleanHtml = html
        ? _sanitizePastedHtml(html)
        : _escapePastedText(cd.getData('text/plain') || '').replace(/\r\n|\r|\n/g, '<br>');
      document.execCommand('insertHTML', false, _trimPastedHtml(cleanHtml));
      sync();
    };
    const onOver = e => {
      const a = e.target.closest('a');
      if (a && edDiv.contains(a)) _showLinkTooltip(a.getAttribute('href') || '', e.clientX, e.clientY);
    };
    const onOut = e => { if (e.target.closest('a')) _hideLinkTooltip(); };
    const onClick = e => {
      const a = e.target.closest('a');
      if (!a || !edDiv.contains(a)) return;
      e.preventDefault();
      _hideLinkTooltip();
      _openLinkPopup(a.textContent, a.getAttribute('href') || '', 'Modifier le lien', 'Modifier', (text, url) => {
        a.href = url;
        a.textContent = text || url;
        sync();
      });
    };
    edDiv.addEventListener('input', onInput);
    edDiv.addEventListener('keydown', onKeydown);
    edDiv.addEventListener('paste', onPaste);
    edDiv.addEventListener('mouseover', onOver);
    edDiv.addEventListener('mousemove', onOver);
    edDiv.addEventListener('mouseout', onOut);
    edDiv.addEventListener('click', onClick);

    return function detach() {
      edDiv.contentEditable = 'false';
      edDiv.removeEventListener('input', onInput);
      edDiv.removeEventListener('keydown', onKeydown);
      edDiv.removeEventListener('paste', onPaste);
      edDiv.removeEventListener('mouseover', onOver);
      edDiv.removeEventListener('mousemove', onOver);
      edDiv.removeEventListener('mouseout', onOut);
      edDiv.removeEventListener('click', onClick);
      _hideLinkTooltip();
    };
  }

  /** Gras / italique / souligné sur la sélection courante d'un élément attaché. */
  function format(edDiv, block, cmd, onChange) {
    document.execCommand(cmd, false, null);
    block.html = _serializeRichText(edDiv);
    if (onChange) onChange();
  }

  /** Insère un lien à la place de la sélection (ou en fin de texte). La
   *  sélection est mémorisée avant l'ouverture de la popup, qui prend le focus. */
  function insertLink(edDiv, block, onChange) {
    const sel = window.getSelection();
    let savedRange = null;
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (edDiv.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
    }
    const defaultText = savedRange ? savedRange.toString() : '';
    _openLinkPopup(defaultText, '', 'Insérer un lien', 'Insérer', (text, url) => {
      edDiv.focus();
      const sel2 = window.getSelection();
      sel2.removeAllRanges();
      if (savedRange) {
        sel2.addRange(savedRange);
      } else {
        const r = document.createRange();
        r.selectNodeContents(edDiv);
        r.collapse(false);
        sel2.addRange(r);
      }
      const range = sel2.getRangeAt(0);
      range.deleteContents();
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = text || url;
      range.insertNode(a);
      range.setStartAfter(a); range.setEndAfter(a);
      sel2.removeAllRanges(); sel2.addRange(range);
      block.html = _serializeRichText(edDiv);
      if (onChange) onChange();
    });
  }

  return { attach, format, insertLink, sanitizeUrl: _sanitizeUrl };
})();
