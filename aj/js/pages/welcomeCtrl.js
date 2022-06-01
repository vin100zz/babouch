app.controller('WelcomeCtrl', ['$scope', 'ChapitresSvc', function($scope, ChapitresSvc) {
   
  $scope.chapitres = ChapitresSvc.chapitres;
  $scope.images = ChapitresSvc.images;

}]);
