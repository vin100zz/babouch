app.controller('ChapitreCtrl', ['$scope', '$http', '$routeParams', '$sce', '$timeout', 'ChapitresSvc', function ($scope, $http, $routeParams, $sce, $timeout, ChapitresSvc) {

  var paths = [$routeParams.path1, $routeParams.path2, $routeParams.path3, $routeParams.path4, $routeParams.path5].filter(x => !!x);

  $timeout(function () {
    var chapitres = ChapitresSvc.chapitres();

    var currentConfig = chapitres;
    var cumulativePath = '#/chapitre';
    var configs = [];
    paths.forEach(path => {
      var config = currentConfig.find(c => c.dossier === path);
      cumulativePath = cumulativePath += '/' + config.dossier;
      config.cumulativePath = cumulativePath;
      configs.push(config);
      currentConfig = config.chapitres;
    });

    $scope.titre_site = ChapitresSvc.titre_site();

    $scope.breadcrumb = configs.map(config => {
      return {
        titre: config.titre,
        link: config.cumulativePath
      };
    });

    var lastConfig = configs[configs.length-1];

    if (lastConfig.chapitres && lastConfig.chapitres.length > 0) {
      $scope.titreChapitre = lastConfig.titre;
      $scope.chapitres = lastConfig.chapitres.map(chapitre => {
        return {
          titre: chapitre.titre,
          link: lastConfig.cumulativePath + '/' + chapitre.dossier
        };
      });
    } else {
      var urlPaths = window.location.pathname.split('/').filter(x => !!x);
      var site = urlPaths[urlPaths.length-1];
      
      $http.get('../_moule/lib/page.php', {
        params: {
          site: site,
          paths: paths.join('/')
        }
      })
      .success(function (data, status) {
        $scope.htmlContent = $sce.trustAsHtml(data.htmlContent);
      });
    }
  });

}]);