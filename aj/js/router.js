app.config(['$routeProvider',

  function($routeProvider) {
    $routeProvider
      .when('/welcome', {
        templateUrl: 'js/pages/welcome.html',
        controller: 'WelcomeCtrl'
      })
      .when('/chapitre/:chapitreId/:pageId', {
        templateUrl: 'js/pages/chapitre.html',
        controller: 'ChapitreCtrl'
      })
      .otherwise({
        redirectTo: '/welcome'
      });
  }
  
]);
