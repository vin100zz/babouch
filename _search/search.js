
function onSubmit() {
  const query = document.querySelector('input[name="query"]').value;
  const category = document.querySelector('input[name="category"]:checked').value;

  if (!query || query.length < 3) {
    return;
  }

  document.getElementById('searching').style.display = 'block';
  document.getElementById('results').innerHTML = '';

  fetch(`search.php?query=${query}&category=${category}`)
  .then(function (response) {
    return response.json();
  }).then(function (data) {
    showResults(data);
  }).catch(function (err) {
    console.warn('Something went wrong.', err);
  });
}

function showResults(results) {
  document.getElementById('searching').style.display = 'none';

  if (!results || results.length === 0) {
    document.getElementById('results').innerHTML = "Pas de résultat !";
    return;
  }

  let html = results.map(result => {
    let link = result.file;
    let pos;

    if (link.includes('/home/babouch/www/')) {
      link = link.substr(18);
    } else {
      pos = link.indexOf('babouch');
      link = link.substr(pos + 8);
    }

    link = '../' + link;
    link = link.replaceAll('\\', '/');
    link = link.replace('contenu/pages', '#/chapitre');
    link = link.replace('pages/content', '#');
    link = link.replace(/(.*)\/.*?\.html/, '$1');

    let site = link.substr(3);
    pos = site.indexOf('/');
    site = site.substring(0, pos);
    site = site.replace(/^\d{1,2}_/, ''); // 4_FMP => FMP
    site = site.replaceAll('_', ' ');
    site = site.toUpperCase();

    return `<a href="${link}">
        <span class="title">${site}</span>
        <span>${result.before}</span><span class="match">${result.match}</span><span>${result.after}</span>
      </a>
  `});

  document.getElementById('results').innerHTML = '<ul><li>' + html.join('</li><li>') + '</li></ul>';
}



