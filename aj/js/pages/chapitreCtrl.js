app.controller('ChapitreCtrl', ['$scope', '$http', '$routeParams', '$sce', 'ChapitresSvc', function ($scope, $http, $routeParams, $sce, ChapitresSvc) {

  $scope.chapitreId = parseInt($routeParams.chapitreId, 10);
  $scope.pageId = parseInt($routeParams.pageId, 10);

  $scope.chapitres = ChapitresSvc.chapitres();
  $scope.chapitre = $scope.chapitres[$scope.chapitreId];
  $scope.page = $scope.chapitre.sous_chapitres[$scope.pageId];

  $http.get('contenu/page.php', {
      params: {
        chapitreId: $scope.chapitreId,
        pageId: $scope.pageId
      }
    })
    .success(function (data, status) {
      $scope.htmlContent = $sce.trustAsHtml(data.htmlContent);
    });

  $scope.isSelected = function (index) {
    return $scope.pageId === index;
  };

  $scope.goHome = function () {
    window.location = '#';
  };

}]);