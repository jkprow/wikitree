(function() {
    angular.module('wikitree.session').

        controller('session_controller',
            ['$scope'
            , 'Search'
            , 'Sessions'
            , 'Utilities'
            , 'init_session'
            , function ($scope, Search, Sessions, Utilities, init_session) {

            var session = this;
            
            /**
             * Session state
             */
            var id = init_session.uuid;

            // history
            var current_node_id = init_session.data.current_node_id;
            var prev_stack = init_session.data.prev_stack;
            var next_stack = init_session.data.next_stack;

            // nodes
            var nodes = init_session.data.nodes;
            var nodes_by_id = {};
            var nodes_by_name = {};

            // links
            var links = init_session.data.links;
            var links_by_id = {};
            var links_by_node_ids = {};

            // wait for load to broadcast update events
            setTimeout(function () {
                $scope.$apply(function () {
                    $scope.$broadcast('update:nodes+links');
                    $scope.$broadcast('update:currentnode');
                });
            }, 1);

            // handle scope destroy
            $scope.$on('$destroy', function () {
                save();
            });

            // handle route change
            $scope.$on('$routeChangeEnd', function () {
                save();
            });

            // handle graph update
            $scope.$on('update:nodes+links', function () {
                save();
            });

            // handle window close
            $(window).on('beforeunload', function () {
                save();
            });


            /**
             * Create a node object
             * @param  {Object}  args        constructor argumentts
             * @param  {String}  args.uuid   unique id.  Default: generate a new one
             * @param  {String}  args.type   node type (article | search | category)
             * @param  {String}  args.title  used if type is article | category
             * @param  {String}  args.query  used if type is search
             * @constructor
             */
            function Node (args) {
                this.uuid = args.uuid || Utilities.makeUUID();
                this.type = args.type;
                this.name = args.name;
                this.title = args.title;
                this.query = args.query;
                // d3 force graph attributes
                // https://github.com/mbostock/d3/wiki/Force-Layout#nodes
                this.index = undefined;  // the zero-based index of the node within the nodes array.
                this.x = undefined;      // the x-coordinate of the current node position.
                this.y = undefined;      // the y-coordinate of the current node position.
                this.px = undefined;     // the x-coordinate of the previous node position.
                this.py = undefined;     // the y-coordinate of the previous node position.
                this.fixed = undefined;  // a boolean indicating whether node position is locked.
                this.weight = undefined; // the node weight; the number of associated links.
            }

            /**
             * Add a node to the session
             * @param {Object} args see Node class for more information
             * @returns {Node} new Node object
             */
            function add_node (args) {
                var node = new Node({
                    type: args.type,
                    name: args.name,
                    title: args.title,
                    query: args.query
                });
                nodes.push(node);
                nodes_by_id[node.uuid] = node;
                nodes_by_name[node.name] = node;
                return node;
            }


            /**
             * Create a link object
             * @param {Object}  args
             * @param {String}  args.uuid      unique id.  Default: generate a new one
             * @param {Number}  args.sourceId  id of source node
             * @param {Number}  args.targetId  id of target node
             * @param {Boolean} args.linkback  if link is cyclical
             * @constructor
             */
            function Link (args) {
                this.uuid = args.uuid || Utilities.makeUUID();
                this.sourceId = args.sourceId;
                this.targetId = args.targetId;
                this.linkback = args.linkback;
                // d3 force graph attributes
                // https://github.com/mbostock/d3/wiki/Force-Layout#links
                this.source = nodes_by_id[this.sourceId];
                this.target = nodes_by_id[this.targetId];
            }

            /**
             * Create a link between two nodes
             * @param {Number} tgt_node_id id of target node
             * @param {Number} src_node_id id of source node
             */
            function link (tgt_node_id, src_node_id) {
                var tgt_node = nodes_by_id[tgt_node_id];
                var src_node = nodes_by_id[src_node_id];

                // no self-referencing nodes
                if (tgt_node_id === src_node_id) return;

                if ((src_node.x || src_node.y) && !(tgt_node.x || tgt_node.y)) {
                    tgt_node.x = src_node.x + Utilities.makeJitter(10);
                    tgt_node.y = src_node.y + Utilities.makeJitter(10);
                }

                if (links_by_node_ids[src_node_id] &&
                    links_by_node_ids[src_node_id][tgt_node_id]) {
                    // it exists, we're done
                } else if (links_by_node_ids[tgt_node_id] &&
                    links_by_node_ids[tgt_node_id][src_node_id]) {
                    // add node with linkback
                    add_link(src_node_id, tgt_node_id, true);
                } else {
                    // add node WITHOUT linkback
                    add_link(src_node_id, tgt_node_id, false);
                }
            }

            /**
             * Add a link to the session
             * @param {Number} source_id ID of source node
             * @param {Number} target_id ID of target node
             * @param linkback
             */
            function add_link (source_id, target_id, linkback) {
                var link = new Link({
                    sourceId: source_id,
                    targetId: target_id,
                    linkback: linkback
                });
                links.push(link);
                if (!links_by_node_ids[source_id]) links_by_node_ids[source_id] = {};
                links_by_node_ids[source_id][target_id] = link;
                links_by_id[link.uuid] = link;
            }


            /**
             * Scope interface
             */

            /**
             * Get the current node ID
             * @returns {Number}
             */
            session.get_current_node_id = function () {
                return nodes_by_id[current_node_id];
            };

            /**
             * Set the currently selected graph node
             * @param   {Number} nodeId
             * @returns {Number} id of current node
             */
            session.set_current_node_id = function (nodeId) {
                // make sure we're not already here
                if (current_node_id === nodeId) return null;
                // as with browser history,
                // when jumping to new page
                // add current to prev stack
                // and flush out next stack
                if (current_node_id) {
                    prev_stack.push(current_node_id);
                }
                next_stack = [];
                current_node_id = nodeId;

                $scope.$broadcast('update:currentnode');
            };

            /**
             * Get session nodes
             * @returns {Array} Copy of nodes array
             */
            session.get_nodes = function () {
                return nodes.slice();
            };

            /**
             * Get session links
             * @returns {Array} Copy of links array
             */
            session.get_links = function () {
                return links.slice();
            };

            /**
             * Whether session history can be advanced
             * @returns {Boolean}
             */
            session.has_forward = function () {
                return !!next_stack.length;
            };

            /**
             * Whether session history can be moved backwards
             * @returns {boolean}
             */
            session.has_backward = function () {
                return !!prev_stack.length;
            };

            /**
             * Select the session node as current
             * @returns {Number} id of new current node
             */
            session.go_backward = function () {
                if (!prev_stack.length) return null;
                next_stack.push(current_node_id);
                current_node_id = prev_stack.pop();

                $scope.$broadcast('update:currentnode');
            };

            /**
             * Select the next session node as current
             * @returns {Number} id of new current node
             */
            session.go_forward = function () {
                if (!next_stack.length) return null;
                prev_stack.push(current_node_id);
                current_node_id = next_stack.pop();

                $scope.$broadcast('update:currentnode');
            };

            /**
             * Remove a node
             * @param {Number} nodeId
             */
            session.remove_node = function (nodeId) {

                // validate existence
                var node = nodes_by_id[nodeId];
                if (!node) return;

                // remove from history ////////////////////////////////////////

                prev_stack = prev_stack
                    .filter(function (id) {
                        return id !== nodeId
                    });
                next_stack = next_stack
                    .filter(function (id) {
                        return id !== nodeId
                    });

                // find a new current node
                if (prev_stack.length) {
                    // try previous first
                    current_node_id = prev_stack.pop();
                } else if (history.next_stack.length) {
                    // how about next
                    current_node_id = next_stack.pop();
                } else {
                    // uh oh
                    current_node_id = null;
                }

                // remove from nodes //////////////////////////////////////////

                nodes = nodes.filter(function (n) {
                    return n.uuid !== node.uuid
                });
                delete nodes_by_id[node.uuid];
                delete nodes_by_name[node.name];

                // remove from links //////////////////////////////////////////

                // remove any links with node from array
                links = links.filter(function (link) {
                    return link.sourceId !== nodeId && link.targetId !== nodeId
                });

                // remove any references by node id
                delete links_by_node_ids[nodeId];
                Object.keys(links_by_node_ids).forEach(function (sourceId) {
                    delete links_by_node_ids[sourceId][nodeId];
                });

                // alert the media
                $scope.$broadcast('update:nodes+links');
                $scope.$broadcast('update:currentnode');
            };

            /**
             * Remove a link
             * @param {Number} source_node_id
             * @param {Number} target_node_id
             */
            session.remove_link = function (source_node_id, target_node_id) {
                var link = links_by_node_id[source_node_id][target_node_id];
                if (!link) return null;
                links = links.filter(function (l) {
                    return l.uuid !== link.uuid
                });
                delete links_by_node_ids[sourceId][targetId];
                delete links_by_id[link.uuid];
            };

            // the big one

            /**
             * Process a search, adding nodes and links as needed
             * @param {String} term search term
             * @param {Number} src_node_id ID of source node
             * @param {Boolean} no_set_current whether to set new node as current
             */
            session.do_search = function (term, src_node_id, no_set_current) {
                var start_time = Date.now();

                if (!(term && term.length)) return;

                Search.findOrAddArticle(term).
                    then(function (result) {

                        console.log(result);

                        // no result?
                        if (!result) {
                            alert('Sorry, something went wrong for "' + term + '"');
                            return;
                        }

                        // should we make a new node or get an existing one?
                        var node = (nodes_by_name[result.name])
                            ? nodes_by_name[result.name]
                            : add_node(result);

                        console.log(node);

                        // does our node need to be linked?
                        if (src_node_id) {
                            link(node.uuid, src_node_id);
                        }

                        $scope.$broadcast('update:nodes+links');

                        if (!no_set_current) {
                            session.set_current_node_id(node.uuid);
                            $scope.$broadcast('update:currentnode');
                        }

                        var end_time = Date.now();
                        console.log('handleTitle complete: ', end_time - start_time);
                    }).
                    catch(function (err) {
                        console.log('oh fuck', err);
                    });
            };

            /**
             * Begin a session
             */
            (function activate() {
                if (init_session.new) {
                    console.log('init new session', init_session);
                    session.do_search(init_session.start);
                    session.new = false;
                }

                nodes.forEach(function (node) {
                    nodes_by_id[node.uuid] = node;
                    nodes_by_name[node.uuid] = node;

                });

                links.forEach(function (link) {
                    console.log('rebuild lynx');
                    var sourceId = link.sourceId;
                    var targetId = link.targetId;
                    link.source = nodes_by_id[sourceId];
                    link.target = nodes_by_id[targetId];
                    links_by_id[link.uuid] = link;
                    if (!links_by_node_ids[sourceId]) links_by_node_ids[sourceId] = {};
                    links_by_node_ids[sourceId][targetId] = link;
                });
            })()

            /**
             * Save a session
             */
            function save () {
                Sessions.save(id, {
                    current_node_id: current_node_id,
                    prev_stack: prev_stack,
                    next_stack: next_stack,
                    nodes: nodes,
                    links: links
                })
            };

        }]);
})();

