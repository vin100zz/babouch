app.controller('MainCtrl', ['$scope', 'ChapitresSvc', function($scope, ChapitresSvc) {
 
  $scope.titre_site = ChapitresSvc.titre_site;

}]);
