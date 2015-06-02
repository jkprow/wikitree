(function() {
    angular.module('wikitree.search').

        controller('searchController', ['$scope', '$location', 'Search',
            function($scope, $location, Search) {

                $scope.inputText = '';

                $scope.get_suggestions = function (term) {
                    return Search.get_suggestions(term);
                };

                $scope.tryEnter = function ($event) {
                    if ($event.keyCode === 13) {
                        $scope.start_search();
                    }
                };

                $scope.start_search = function () {
                    var term = $scope.inputText;

                    if (term) {
                        if ($scope.new_session) {
                            $location.path('/new/' + term);
                        } else {
                            $scope.session.do_search(term)
                        }
                    }

                    $scope.inputText = '';

                };
            }]);

})();
