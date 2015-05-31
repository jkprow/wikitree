(function () {
    angular.module('wikitree.session.graph').
        controller('graphController', [
            '$scope',
            'Resizer',
            function ($scope, Resizer) {

            	// for graph position
                $scope.positionRight = Resizer.size + 'px';


                /**
                 * Global events
                 */

                // handle "toggle node pin" button
                $scope.$on('request:graph:toggle_node_pin', function () {
                    //var node = CurrentSession.getCurrentNode();
                    var node = $scope.session.get_current_node();
                    $scope.graph.toggleNodePin(node);
                });

                // handle "locate current node" button
                $scope.$on('request:graph:locate_current_node', function () {
                    //var node = CurrentSession.getCurrentNode();
                    var node = $scope.session.get_current_node();
                    $scope.graph.centerOnNode(node);
                });

                // handle map/reader split resize
                $scope.$on('split:resize', function (e, data) {
                    $scope.positionRight = Resizer.size + 'px';
                    $scope.graph.updateSize();
                });

                // handle model update (nodes + links)
                $scope.$on('update:nodes+links', function () {

                    console.log('did the thing');
                	//var nodes = CurrentSession.getNodes().slice();
                    //var links = CurrentSession.getLinks().slice();
                    var nodes = $scope.session.nodes.slice();
                    var links = $scope.session.links.slice();
                    $scope.graph.updateNodesAndLinks(nodes, links);
                });

                // handle model update (current node)
                $scope.$on('update:currentnode', function () {
                    //var node = CurrentSession.getCurrentNode();
                    var node = $scope.session.get_current_node();
                    $scope.graph.updateCurrentNode(node);
                });


                /**
                 * Scope methods
                 */

                //$scope.saveSession = function () {
                //    Sessions.save();
                //};

                $scope.setCurrentNode = function (nodeId) {
                    //CurrentSession.setCurrentNode(nodeId);
                    $scope.session.set_current_node_id(nodeId);
                };


            }
        ]);
})();
