app.controller('WelcomeCtrl', ['$scope', '$timeout', 'ChapitresSvc', function($scope, $timeout, ChapitresSvc) {

$timeout(function () {
  $scope.chapitres = ChapitresSvc.chapitres;
  $scope.titre_site = ChapitresSvc.titre_site();
 }, 1000);
   
}]);
