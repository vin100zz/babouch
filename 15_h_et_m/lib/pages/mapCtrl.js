app.controller('MapCtrl', ['$scope', '$timeout', '$http', 'ChapitresSvc', function($scope, $timeout, $http, ChapitresSvc) {

  $timeout(function () {
    $scope.chapitres = ChapitresSvc.chapitres();
    refresh();
  }, 1000);

  function refresh() {
    $scope.flat = [];
    $scope.chapitres.forEach((chapitre, index) => processNode(chapitre, $scope.chapitres, 0, index, $scope.chapitres.length === 1));
  }

  function processNode(node, parentNode, indent, index, lastNode) {
    var flatNode = {
      indent: indent,
      titre: node.titre,
      dossier: node.dossier,
      node: node,
      firstNode: index === 0,
      lastNode: lastNode
    };

    if (indent === 0) {
      flatNode.x = node.x;
      flatNode.y = node.y;
      flatNode.image = node.image;
    }

    $scope.flat.push(flatNode);

    node.parentNode = parentNode;
    node.index = index;
    node.indent = indent;

    if (!node.collapsed) {
      (node.chapitres || []).forEach((chapitre, index) => processNode(chapitre, node, indent+1, index, index === (node.chapitres || []).length-1));
    }
  }

  $scope.toggleCollapse = function (node) {
    node.collapsed = !node.collapsed;
    refresh();
  }

  $scope.moveUp = function (node) {
    var extracted = node.parentNode.chapitres.splice(node.index, 1)[0];
    node.parentNode.chapitres.splice(node.index-1, 0, extracted);
    refresh();
  }

  $scope.moveDown = function (node) {
    var extracted = node.parentNode.chapitres.splice(node.index, 1)[0];
    node.parentNode.chapitres.splice(node.index+1, 0, extracted);
    refresh();
  }

  $scope.addSibling = function (node) {
    (node.indent === 0 ? node.parentNode : node.parentNode.chapitres).splice(node.index+1, 0, {
      titre: 'Titre',
      dossier: 'dossier'
    });
    refresh();
  }

  $scope.addChild = function (node) {
    node.chapitres = [{
      titre: 'Titre',
      dossier: 'dossier'
    }];
    refresh();
  }

  $scope.delete = function (node) {
    node.parentNode.chapitres.splice(node.index, 1);
    refresh();
  }

  $scope.refreshFields = function (line) {
    line.node.titre = line.titre;
    line.node.dossier = line.dossier;
    if (line.indent === 0) {
      line.node.x = line.x;
      line.node.y = line.y;
      line.node.image = line.image;
    }
    refresh();
  }

  $scope.save = function () {
    var urlPaths = window.location.pathname.split('/').filter(x => !!x);
    var site = urlPaths[urlPaths.length-1];

    $http.post('../_moule/lib/save.php?site=' + site, clean())
    .success(function (data, status) {
      ChapitresSvc.refresh();
      window.location = '#';
    });
  }

  function clean() {
    var res = {
      titre_site: ChapitresSvc.titre_site()
    };
    res.chapitres = $scope.chapitres.map(chapitre => cleanNode(chapitre));
    return JSON.stringify(res, null, 2);
  }

  function cleanNode(node) {
    var res = {
      titre: node.titre,
      dossier: node.dossier
    };
    if (node.x !== undefined) {
      res.x = node.x;
      res.y = node.y;
      res.image = node.image;
    }
    if (node.chapitres) {
      res.chapitres = node.chapitres.map(chapitre => cleanNode(chapitre));
    }
    return res;
  }

}]);
