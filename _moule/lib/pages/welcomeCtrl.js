app.controller('WelcomeCtrl', ['$scope', '$timeout', 'ChapitresSvc', function($scope, $timeout, ChapitresSvc) {

$scope.suggestions = [];

$scope.searchInput = '';

$timeout(function () {
  $scope.chapitres = ChapitresSvc.chapitres;
  $scope.titre_site = ChapitresSvc.titre_site();
 }, 1000);

$scope.onSearchChange = function () {
  $scope.suggestions = [];
  if ($scope.searchInput.length > 1) {
    var chapitres = $scope.chapitres();
    addSuggestions(chapitres, '');
    $scope.suggestions = $scope.suggestions.sort((s1, s2) => s1.label.localeCompare(s2.label));
  }
}

addSuggestions = function (chapitres, path) {
  (chapitres || []).forEach(chapitre => {
    if (chapitre.titre && chapitre.titre.toLowerCase().match($scope.searchInput.toLowerCase())) {
      $scope.suggestions.push({label: chapitre.titre, link: path + chapitre.dossier});
    }
    addSuggestions(chapitre.chapitres, path + chapitre.dossier + '/');
  });
}

$scope.onClick = function () {
  $scope.searchInput = '';
  $scope.suggestions = [];
}
   
}]);
