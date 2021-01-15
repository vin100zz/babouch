app.controller('WelcomeCtrl', ['$scope', 'ChapitresSvc', function($scope, ChapitresSvc) {
   
  $scope.chapitres = ChapitresSvc.chapitres;
  $scope.titre_site = ChapitresSvc.titre_site();

}]);
