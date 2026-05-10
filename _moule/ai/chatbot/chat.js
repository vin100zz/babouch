// ── Mode dry-run (true = pas d'appel OpenAI, affiche le prompt) ──────────
var DRYRUN = false;


// ── Envoi via le formulaire ───────────────────────────────────────────────
function sendMessage(event) {
    event.preventDefault();
    const input    = document.getElementById('input');
    const question = input.value.trim();
    if (!question || isLoading()) return;
    input.value = '';
    ask(question);
}

// ── Envoi via une suggestion ──────────────────────────────────────────────
function askSuggestion(btn) {
    if (isLoading()) return;
    // Désactive toutes les suggestions du message d'accueil
    document.querySelectorAll('.suggestions button').forEach(b => b.disabled = true);
    ask(btn.textContent.trim());
}

// ── Demande principale ────────────────────────────────────────────────────
function ask(question) {
    addUserMessage(question);

    const loadingId = addLoading();
    setUiDisabled(true);

    fetch('chat.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: question, dryrun: DRYRUN }),
    })
    .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    })
    .then(data => {
        removeLoading(loadingId);
        if (data.error) {
            addBotMessage('⚠️ ' + data.error);
        } else {
            addBotAnswer(data.answer, data.sources || []);
            if (data.dryrun && data.prompt) {
                addPromptDebug(data.prompt);
            }
        }
    })
    .catch(err => {
        removeLoading(loadingId);
        addBotMessage('⚠️ Une erreur est survenue. Veuillez réessayer.<br><small>' + escHtml(err.message) + '</small>');
        console.error('[chatbot]', err);
    })
    .finally(() => {
        setUiDisabled(false);
        document.getElementById('input').focus();
    });
}

// ── Helpers d'affichage ───────────────────────────────────────────────────

function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `<div class="bubble">${escHtml(text).replace(/\n/g, '<br>')}</div>`;
    appendMessage(div);
}

function addBotMessage(html) {
    const div = document.createElement('div');
    div.className = 'message bot';
    div.innerHTML = `<div class="avatar">🐱</div><div class="bubble">${html}</div>`;
    appendMessage(div);
}

function addBotAnswer(text, sources) {
    // Formatage du texte (markdown léger)
    const formattedText = formatMarkdown(text);

    // Accordéon des sources
    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        const unique = [...new Set(sources)];
        const items  = unique.slice(0, 10).map(s => `<li>${escHtml(s)}</li>`).join('');
        sourcesHtml  = `<details class="sources">
            <summary>${unique.length} source(s) consultée(s)</summary>
            <ul>${items}</ul>
        </details>`;
    }

    const div = document.createElement('div');
    div.className = 'message bot';
    div.innerHTML = `<div class="avatar">🐱</div><div class="bubble">${formattedText}${sourcesHtml}</div>`;
    appendMessage(div);
}

function addLoading() {
    const id  = 'ld_' + Date.now();
    const div = document.createElement('div');
    div.id        = id;
    div.className = 'message bot';
    div.innerHTML = `<div class="avatar">🐱</div>
        <div class="bubble">
            <div class="typing"><span></span><span></span><span></span></div>
        </div>`;
    appendMessage(div);
    return id;
}

function removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function appendMessage(el) {
    document.getElementById('messages').appendChild(el);
    scrollToBottom();
}

function scrollToBottom() {
    const msgs = document.getElementById('messages');
    msgs.scrollTop = msgs.scrollHeight;
}

// ── État UI ───────────────────────────────────────────────────────────────

let _loading = false;

function isLoading() { return _loading; }

function setUiDisabled(disabled) {
    _loading = disabled;
    document.getElementById('sendbtn').disabled = disabled;
    document.getElementById('input').disabled   = disabled;
}

// ── Formatage du texte ────────────────────────────────────────────────────

function formatMarkdown(text) {
    // 1. Extraire les liens markdown [label](url) avant l'échappement HTML
    var links = [];
    var withPlaceholders = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, label, url) {
        var idx = links.length;
        links.push({ label: label, url: url });
        return '\x00LINK' + idx + '\x00';
    });

    // 2. Échapper le HTML
    var escaped = escHtml(withPlaceholders);

    // 3. Réinjecter les liens en <a href> (URL limitée à des chemins relatifs)
    escaped = escaped.replace(/\x00LINK(\d+)\x00/g, function(match, idx) {
        var link  = links[parseInt(idx)];
        var safeUrl = link.url.replace(/['"<>]/g, '');  // sécurité minimale
        return '<a href="' + safeUrl + '" target="_blank">' + escHtml(link.label) + '</a>';
    });

    // 4. Gras, italique, sauts de ligne, listes
    return escaped
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g,     '<em>$1</em>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g,     '<br>')
        .replace(/(<br>|^)- (.+?)(?=<br>|<\/p>|$)/g, '$1• $2')
        .replace(/^(?!<p>)/, '<p>')
        .replace(/(?<!>)$/, '</p>');
}

function addPromptDebug(prompt) {
    var div = document.createElement('div');
    div.className = 'message bot prompt-debug';
    div.innerHTML = '<div class="avatar">🔍</div>'
        + '<div class="bubble">'
        + '<details><summary>📋 Prompt envoyé (dry-run)</summary>'
        + '<pre>' + escHtml(prompt) + '</pre>'
        + '</details></div>';
    appendMessage(div);
}

function escHtml(str) {    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
}

// ── Raccourci clavier : Entrée pour envoyer ───────────────────────────────
document.getElementById('input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chatform').dispatchEvent(new Event('submit'));
    }
});

