app.service('ChapitresSvc', ['$rootScope', '$http', function($rootScope, $http){

  var titre_site = '';
  var chapitres = [];
  var images = [];

  $http.get('contenu/chapitres.json')
    .success(function(data, status) {
      titre_site = data.titre_site;
      chapitres = data.chapitres;
      images = data.images;
  });
  
  return {
    titre_site : function () {
      return titre_site;
    },
    
    chapitres : function () {
      return chapitres;
    },
    
    images : function () {
      return images;
    }
  };
}]);
