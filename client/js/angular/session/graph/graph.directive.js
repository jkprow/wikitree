(function() {
    angular.module('wikitree.session.graph').
        directive('graph', ['$rootScope', '$timeout', function($rootScope, $timeout) {
            return {
                restrict: 'E',
                replace: true,
                templateUrl: '/js/angular/session/graph/graph.template.html',
                controller: 'graphController',
                link: function(scope, element) {
                    //$timeout(function () {
                        scope.graph = new ForceGraph(
                            element[0],
                            scope
                        );
                    //});
                    //$scope.$broadcast('update:nodes+links');
                    //$scope.$broadcast('update:currentnode');
                }
            }
        }]);
})();
