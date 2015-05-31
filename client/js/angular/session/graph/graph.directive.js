(function() {
    angular.module('wikitree.session.graph').
        directive('graph', ['$rootScope', function($rootScope) {
            return {
                restrict: 'E',
                replace: true,
                templateUrl: '/js/angular/session/graph/graph.template.html',
                controller: 'graphController',
                link: function(scope, element) {
                    scope.graph = new ForceGraph(
                        element[0],
                        scope
                    );
                }
            }
        }]);
})();
