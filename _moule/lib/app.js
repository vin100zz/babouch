var app = angular.module('App', ['ngRoute']);

app.service('ChapitresSvc', ['$rootScope', '$http', function($rootScope, $http){
  var titre_site = '';
  var chapitres = [];

  var get = function () {
    $http.get('contenu/chapitres.json?ts=' + Date.now())
      .success(function(data, status) {
        chapitres = data.chapitres;
        titre_site = data.titre_site;
        document.title = titre_site;
    });
  };

  get();
  
  return {
    refresh : function () {
      get();
    },
    titre_site : function () {
      return titre_site;
    },
    chapitres : function () {
      return chapitres;
    }
  };
}]);

app.controller('MainCtrl', ['$scope', 'ChapitresSvc', function($scope, ChapitresSvc) {
  $scope.titre_site = ChapitresSvc.titre_site;
}]);

app.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider
      .when('/welcome', {
        templateUrl: '../_moule/lib/pages/welcome.html',
        controller: 'WelcomeCtrl'
      })
      .when('/chapitre/:path1', {
        templateUrl: '../_moule/lib/pages/chapitre.html',
        controller: 'ChapitreCtrl'
      })
      .when('/chapitre/:path1/:path2', {
        templateUrl: '../_moule/lib/pages/chapitre.html',
        controller: 'ChapitreCtrl'
      })
      .when('/chapitre/:path1/:path2/:path3', {
        templateUrl: '../_moule/lib/pages/chapitre.html',
        controller: 'ChapitreCtrl'
      })
      .when('/chapitre/:path1/:path2/:path3/:path4', {
        templateUrl: '../_moule/lib/pages/chapitre.html',
        controller: 'ChapitreCtrl'
      })
      .when('/chapitre/:path1/:path2/:path3/:path4/:path5', {
        templateUrl: '../_moule/lib/pages/chapitre.html',
        controller: 'ChapitreCtrl'
      })
      .when('/map', {
        templateUrl: '../_moule/lib/pages/map.html',
        controller: 'MapCtrl'
      })
      .otherwise({
        redirectTo: '/welcome'
      });
  }  
]);



