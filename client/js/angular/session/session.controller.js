(function() {
    angular.module('wikitree.session').

        controller('session_controller',
            ['$scope'
            ,'$rootScope'
            ,'Search'
            ,'Sessions'
            ,'Utilities'
            ,'init_session'
            ,function($scope, $rootScope, Search, Sessions, Utilities, init_session) {

                var session = this;

                session.message = "hello!";

                /**
                 * Session state
                 */
                session.id                = init_session.uuid;

                session.current_node_id   = init_session.data.current_node_id;
                session.prev_stack        = init_session.data.prev_stack;
                session.next_stack        = init_session.data.next_stack;

                session.nodes             = init_session.data.nodes;
                session.nodes_by_id       = {}; //init_session.data.nodes_by_id;
                session.nodes_by_name     = {}; //init_session.data.nodes_by_name;

                session.links             = init_session.data.links;
                session.links_by_id       = {}; //init_session.data.links_by_id;
                session.links_by_node_ids = {}; //init_session.data.links_by_node_ids;

                setTimeout(function(){
                    $scope.$apply(function(){
                        $scope.$broadcast('update:nodes+links');
                        $scope.$broadcast('update:currentnode');
                    });
                }, 1000);



                // back up before route changes
                $scope.$on('$routeChangeStart', function() {
                    session.save();
                });

                $rootScope.$on('update:nodes+links', function () {
                    session.save();
                });

                $(window).on('beforeunload', function () {
                    session.save();
                });

                session.save = function () {
                    Sessions.save(session.id, {
                        current_node_id:   session.current_node_id,
                        prev_stack:        session.prev_stack,
                        next_stack:        session.next_stack,
                        nodes:             session.nodes,
                        //nodes_by_id:       session.nodes_by_id,
                        //nodes_by_name:     session.nodes_by_name,
                        links:             session.links //,
                        //links_by_id:       session.links_by_id,
                        //links_by_node_ids: session.links_by_node_ids
                    })
                };

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
                    this.linkback = false;
                    // d3 force graph attributes
                    // https://github.com/mbostock/d3/wiki/Force-Layout#links
                    this.source = session.nodes_by_id[this.sourceId];
                    this.target = session.nodes_by_id[this.targetId];
                }


                // the big one

                session.do_search = function(title, src_node_id, no_set_current) {
                    var start_time = Date.now();

                    if (!(title && title.length)) return;

                    Search.findOrAddArticle(title).
                        then(function (result) {
                            //debugger

                            console.log(result);

                            // no result?
                            if (!result) {
                                alert('Sorry, something went wrong for "' + title + '"');
                                return;
                            }

                            // should we make a new node or get an existing one?
                            var node = (session.nodes_by_name[result.name])
                                     ?  session.nodes_by_name[result.name]
                                     :  session.add_node(result);

                            console.log(node);

                            // does our node need to be linked?
                            if (src_node_id) {
                                session.link(node, src_node_id);
                            }

                            $rootScope.$broadcast('update:nodes+links');

                            if (!no_set_current) {
                                session.set_current_node_id(node.uuid);
                                $rootScope.$broadcast('update:currentnode');
                            }

                            var end_time = Date.now();
                            console.log('handleTitle complete: ', end_time - start_time);
                        });
                };

                /**
                 * Initialize the session if new
                 */
                if (init_session.new) {
                    session.do_search(init_session.start);
                    session.new = false;
                }

                session.nodes.forEach(function (node) {
                    session.nodes_by_id[node.uuid] = node;
                    session.nodes_by_name[node.uuid] = node;

                });

                session.links.forEach(function (link) {
                    console.log('rebuild lynx');
                    var sourceId = link.sourceId;
                    var targetId = link.targetId;
                    link.source = session.nodes_by_id[sourceId];
                    link.target = session.nodes_by_id[targetId];
                    session.links_by_id[link.uuid] = link;
                    if (!session.links_by_node_ids[sourceId]) session.links_by_node_ids[sourceId] = {};
                    session.links_by_node_ids[sourceId][targetId] = link;
                });


                session.link = function (tgt_node, src_node_id) {
                    var tgt_node_id = tgt_node.uuid;

                    // no self-referencing nodes
                    if (tgt_node_id === src_node_id) return;

                    var src_node = session.nodes_by_id[src_node_id];
                    if ((src_node.x || src_node.y) && !(tgt_node.x || tgt_node.y)) {
                        tgt_node.x = src_node.x + Utilities.makeJitter(10);
                        tgt_node.y = src_node.y + Utilities.makeJitter(10);
                    }

                    if (session.links_by_node_ids[src_node_id] &&
                        session.links_by_node_ids[src_node_id][tgt_node_id]) {
                        // grab existing link
                        //link = links.byNodeIds[sourceId][targetId];
                        // it exists, we're done here
                        return;
                    } else if (session.links_by_node_ids[tgt_node_id] &&
                               session.links_by_node_ids[tgt_node_id][src_node_id]) {
                        // add new link, but mark as duplicate

                        // add node with linkback
                        session.add_link(src_node_id, tgt_node_id, true);
                    } else {
                        // add node WITHOUT linkback
                        session.add_link(src_node_id, tgt_node_id, false);
                    }
                };

                /**
                 * Readers
                 */

                // just get this directly?
                session.get_current_node = function () {
                    return session.nodes_by_id[session.current_node_id];
                };

                // just get this directly?
                session.get_nodes = function () {
                    return session.nodes;
                };

                // just get this directly?
                session.get_links = function () {
                    return session.links;
                };

                session.has_forward = function () {
                    return !!session.next_stack.length;
                };

                session.has_backward = function () {
                    return !!session.prev_stack.length;
                };

                /**
                 * Mutators
                 */

                /**
                 * Set the currently selected graph node
                 * @param   {Number} nodeId
                 * @returns {Number} id of current node
                 */
                session.set_current_node_id = function (nodeId) {
                    // make sure we're not already here
                    if (session.current_node_id === nodeId) return null;
                    // as with browser history,
                    // when jumping to new page
                    // add current to prev stack
                    // and flush out next stack
                    if (session.current_node_id) {
                        session.prev_stack.push(session.current_node_id);
                    }
                    session.next_stack = [];
                    session.current_node_id = nodeId;
                    //return history.currentId;
                    $rootScope.$broadcast('update:currentnode');
                };

                /**
                 * Select the previous graph node as current
                 * @returns {Number} id of new current node
                 */
                session.go_backward = function () {
                    if (!session.prev_stack.length) return null;
                    session.next_stack.push(session.current_node_id);
                    session.current_node_id = session.prev_stack.pop();
                    //return history.currentId;
                    $rootScope.$broadcast('update:currentnode');
                };

                /**
                 * Select the next graph node as current
                 * @returns {Number} id of new current node
                 */
                session.go_forward = function () {
                    if (!session.next_stack.length) return null;
                    session.prev_stack.push(session.current_node_id);
                    session.current_node_id = session.next_stack.pop();
                    //return history.currentId;
                    $rootScope.$broadcast('update:currentnode');
                };

                session.add_node = function (args) {
                    var node = new Node({
                        type:  args.type,
                        name:  args.name,
                        title: args.title,
                        query: args.query
                    });
                    session.nodes.push(node);
                    session.nodes_by_id[node.uuid] = node;
                    session.nodes_by_name[node.name] = node;
                    return node;
                };

                session.add_link = function (source_id, target_id, linkback) {
                    var link = new Link({
                        sourceId: source_id,
                        targetId: target_id,
                        linkback: linkback
                    });
                    session.links.push(link);
                    if (!session.links_by_node_ids[source_id]) session.links_by_node_ids[source_id] = {};
                    session.links_by_node_ids[source_id][target_id] = link;
                    session.links_by_id[link.uuid] = link;
                    //return link;
                };

                /**
                 * Remove a node
                 */
                session.remove_node = function (nodeId) {

                    // validate existence
                    var node = session.nodes_by_id[nodeId];
                    if (!node) return;

                    /*
                     * REMOVE FROM HISTORY
                     */

                    // expunge from past & future
                    session.prev_stack = session.prev_stack
                        .filter(function (id) {
                            return id !== nodeId
                        });
                    session.next_stack = session.next_stack
                        .filter(function (id) {
                            return id !== nodeId
                        });

                    // find a new current node
                    if (session.prev_stack.length) {
                        // try previous first
                        session.current_node_id = session.prev_stack.pop();
                    } else if (history.next_stack.length) {
                        // how about next
                        session.current_node_id = session.next_stack.pop();
                    } else {
                        // uh oh
                        session.current_node_id = null;
                    }

                    // we did what we could
                    //return history.currentId;

                    /*
                     * REMOVE FROM NODES
                     */

                    //var node = nodes.byId[nodeId];
                    //if (!node) return null;
                    session.nodes = session.nodes.filter(function (n) { return n.uuid !== node.uuid });
                    delete session.nodes_by_id[node.uuid];
                    delete session.nodes_by_name[node.name];
                    //return node;

                    /*
                     * REMOVE FROM LINKS
                     */

                    // remove any links with node from array
                    session.links = session.links.filter(function (link) {
                        return link.sourceId !== nodeId && link.targetId !== nodeId
                    });

                    // remove any references by node id
                    delete session.links_by_node_ids[nodeId];
                    Object.keys(session.links_by_node_ids).forEach(function (sourceId) {
                        delete session.links_by_node_ids[sourceId][nodeId];
                    });

                    // remove from collections
                    //removeFromHistory(node.uuid);
                    //removeFromNodes(node.uuid);
                    //removeFromLinks(node.uuid);

                    // alert the media
                    $rootScope.$broadcast('update:nodes+links');
                    $rootScope.$broadcast('update:currentnode');
                };



                ///**
                // * Packages and exports all history state
                // * @returns {{currentId: Number, prevStack: Array, nextStack: Array}}
                // */
                //exportState: function () {
                //    return {
                //        currentId: history.currentId,
                //        prevStack: history.prevStack,
                //        nextStack: history.nextStack
                //    }
                //},
                //
                //    /**
                //     * Imports all history state
                //     * @param {Number} state.currentId
                //     * @param {Array}  state.prevStack
                //     * @param {Array}  state.nextStack
                //     */
                //    importState: function (state) {
                //        history.currentId = state.currentId;
                //        history.prevStack = state.prevStack;
                //        history.nextStack = state.nextStack;
                //    },
                //
                //    /**
                //     * Clears all history state
                //     */
                //    clearState: function () {
                //        history.currentId = undefined;
                //        history.prevStack = [];
                //        history.nextStack = [];
                //    }
                //};






                ///**
                // * Node collection
                // * @namespace
                // */
                //
                //    /**
                //     * Add a new node to the graph
                //     * @param   {Object} args (see class Node)
                //     * @returns {Node}   created Node object
                //     */
                //    addNode: function (args) {
                //        var node = new Node({
                //            type: args.type,
                //            name: args.name,
                //            title: args.title,
                //            query: args.query
                //        });
                //        nodes.arr.push(node);
                //        nodes.byId[node.uuid] = node;
                //        nodes.byName[node.name] = node;
                //        return node;
                //    }



                    ///**
                    // * Packages and exports all node state
                    // * @returns {{arr: Array}}
                    // */
                    //exportState: function () {
                    //    return {
                    //        arr: nodes.arr
                    //    }
                    //},
                    //
                    ///**
                    // * Imports all node state
                    // * @param {Object} state
                    // * @param {Array}  state.arr
                    // */
                    //importState: function (state) {
                    //    nodes.arr = state.arr;
                    //    nodes.byId = {};
                    //    nodes.byName = {};
                    //    nodes.arr.forEach(function (node) {
                    //        nodes.byId[node.uuid] = node;
                    //        nodes.byName[node.name] = node;
                    //    });
                    //},
                    //
                    ///**
                    // * Clears all node state
                    // */
                    //clearState: function () {
                    //    nodes.arr = [];
                    //    nodes.byId = {};
                    //    nodes.byName = {};
                    //}


                /**
                 * Create a link object
                 * @param {Object}  args
                 * @param {String}  args.uuid      unique id.  Default: generate a new one
                 * @param {Number}  args.sourceId  id of source node
                 * @param {Number}  args.targetId  id of target node
                 * @param {Boolean} args.linkback  if link is cyclical
                 * @constructor
                 */


                /**
                 * Link collection
                 * @namespace
                 */

                    /**
                     * Add a link to the graph
                     * @param    {Number}  sourceId  id of source node
                     * @param    {Number}  targetId  id of target node
                     * @returns  {Link}    created Link object
                     */
                    //addLink: function (sourceId, targetId) {
                    //    var link = new Link({
                    //        sourceId: sourceId,
                    //        targetId: targetId
                    //    });
                    //    links.arr.push(link);
                    //    if (!links.byNodeIds[sourceId]) links.byNodeIds[sourceId] = {};
                    //    links.byNodeIds[sourceId][targetId] = link;
                    //    links.byId[link.uuid] = link;
                    //    return link;
                    //},

                    ///**
                    // * Remove a link from the graph based
                    // * @param    {Number}  sourceId  id of source node
                    // * @param    {Number}  targetId  id of target node
                    // * @returns  {Link}    removed Link object
                    // */
                    //removeLink: function (sourceId, targetId) {
                    //    var link = links.byNodeIds[sourceId][targetId];
                    //    if (!link) return null;
                    //    links.arr = links.arr.filter(function (l) { return l.uuid !== link.uuid });
                    //    delete links.byNodeIds[sourceId][targetId];
                    //    delete links.byId[link.uuid];
                    //    return link;
                    //},



                    ///**
                    // * Packages and exports all link state
                    // * @returns {{arr: Array}}
                    // */
                    //exportState: function () {
                    //    return {
                    //        arr: links.arr
                    //    }
                    //},
                    //
                    ///**
                    // * Imports all link state
                    // * @param {Object} state
                    // * @param {Array}  state.arr
                    // */
                    //importState: function (state) {
                    //    links.arr = state.arr;
                    //    links.byId = {};
                    //    links.byNodeIds = {};
                    //    links.arr.forEach(function (link) {
                    //        var sourceId = link.sourceId;
                    //        var targetId = link.targetId;
                    //        link.source = nodes.byId[sourceId];
                    //        link.target = nodes.byId[targetId];
                    //        links.byId[link.uuid] = link;
                    //        if (!links.byNodeIds[sourceId]) links.byNodeIds[sourceId] = {};
                    //        links.byNodeIds[sourceId][targetId] = link;
                    //    });
                    //},
                    //
                    ///**
                    // * Clears all link state
                    // */
                    //clearState: function () {
                    //    links.arr = [];
                    //    links.byId = {};
                    //    links.byNodeIds = {};
                    //}

                ///**
                // * Get article data
                // * @param   {String} title
                // * @returns {Promise} Resolves to Article data
                // */
                //function findOrAddArticle(title) {
                //
                //    // is this a category?
                //    if (title.match(/^Category:/)) {
                //        // skip to special handler
                //        return findOrAddCategory(title);
                //    }
                //
                //    return Articles.getByUnsafeTitle(title).
                //        then(function (article) {
                //            return{
                //                type: 'article',
                //                name: article.title,
                //                title: article.title
                //            };
                //        }).
                //        catch(function (err) {
                //            console.log('In findOrAddArticle', err);
                //            // no result? try searching
                //            return findOrAddSearch(title);
                //        });
                //}
                //
                ///**
                // * Get category data
                // * @param title
                // * @returns {Promise} Resolves to category data
                // */
                //function findOrAddCategory(title) {
                //    return Categories.getByUnsafeTitle(title).
                //        then(function (category) {
                //            return {
                //                type: 'category',
                //                name: category.title,
                //                title: category.title
                //            };
                //        }).
                //        catch(function (err) {
                //            console.log('In findOrAddCategory', err);
                //            // no result? try searching
                //            return findOrAddSearch(title);
                //        });
                //}
                //
                ///**
                // * Get search results
                // * @param {String} query
                // * @returns {Promise} Resolves to search results data
                // */
                //function findOrAddSearch(query) {
                //    return Searches.getByQuery(query).
                //        then(function (search) {
                //            return {
                //                type: 'search',
                //                name: 'Search "' + query + '"',
                //                query: query
                //            };
                //        }).
                //        catch(function (err) {
                //            console.log('In findOrAddSearch', err);
                //            // no dice
                //            return null;
                //        });
                //}
                //
                ///**
                // * Find node in the current graph, add if not found
                // * @param {Object} args see class Node for details
                // * @param {Function} callback
                // */
                //function findOrAddNode(args, callback) {
                //    var node = nodes.byName[args.name];
                //    if (!node) node = nodes.addNode(args);
                //    callback(node);
                //};
                //
                ///**
                // *Find link in the current graph, add if not found
                // * @param {Node} node
                // * @param {Number} sourceId
                // * @param {Function} callback
                // */
                //function findOrAddLink(node, sourceId, callback) {
                //    var targetId = node.uuid;
                //
                //    // wait lol, no self-referencing nodes
                //    if (targetId === sourceId) {
                //        callback(null);
                //        return;
                //    }
                //
                //    // TODO not sure where to put this
                //    // give source coords to target node
                //    var source = nodes.byId[sourceId];
                //    if ((source.x || source.y) && !(node.x || node.y)) {
                //        node.x = source.x + Utilities.makeJitter(10);
                //        node.y = source.y + Utilities.makeJitter(10);
                //    }
                //
                //    var link = null;
                //    if (links.byNodeIds[sourceId] &&
                //        links.byNodeIds[sourceId][targetId]) {
                //        // grab existing link
                //        link = links.byNodeIds[sourceId][targetId];
                //    } else if (links.byNodeIds[targetId] &&
                //        links.byNodeIds[targetId][sourceId]) {
                //        // add new link, but mark as duplicate
                //        link = links.addLink(sourceId, targetId);
                //        link.linkback = true;
                //    } else {
                //        // add new link
                //        link = links.addLink(sourceId, targetId);
                //    }
                //
                //    callback(link);
                //}

                /**
                 * Public interface
                 */



                    /**
                     * Change state
                     */

                   /* goForward: function () {
                        history.goForward();
                        $rootScope.$broadcast('update:currentnode');
                    },*/

                    /*goBackward: function () {
                        history.goBackward();
                        $rootScope.$broadcast('update:currentnode');
                    },*/

                    /*setCurrentNode: function (nodeId) {
                        history.setCurrentId(nodeId);
                        $rootScope.$broadcast('update:currentnode');
                    },*/




                    ///**
                    // * Manage state
                    // */
                    //
                    //importState: function(session) {
                    //    session = session.data;
                    //
                    //    history.importState(session.history);
                    //    nodes.importState(session.nodes);
                    //    links.importState(session.links);
                    //
                    //    $rootScope.$broadcast('update:nodes+links');
                    //    $rootScope.$broadcast('update:currentnode');
                    //},
                    //
                    //exportState: function() {
                    //    return {
                    //        history: history.exportState(),
                    //        nodes: nodes.exportState(),
                    //        links: links.exportState()
                    //    }
                    //},
                    //
                    //clearState: function() {
                    //    history.clearState();
                    //    nodes.clearState();
                    //    links.clearState();
                    //
                    //    $rootScope.$broadcast('update:nodes+links');
                    //}






}]);
})();

/**
 * Removes the specified node from history
 * @param   {Number} nodeId
 * @returns {Number} id of new current node
 */
//var removeFromHistory = function (nodeId) {
//    // expunge from past & future
//    history.prevStack = history.prevStack
//        .filter(function (id) {
//            return id !== nodeId
//        });
//    history.nextStack = history.nextStack
//        .filter(function (id) {
//            return id !== nodeId
//        });
//
//    // find a new current node
//    if (history.prevStack.length) {
//        // try previous first
//        history.currentId = history.prevStack.pop();
//    } else if (history.nextStack.length) {
//        // how about next
//        history.currentId = history.nextStack.pop();
//    } else {
//        // uh oh
//        history.currentId = null;
//    }
//
//    // we did what we could
//    //return history.currentId;
//
//};

/**
 * Remove node with specified id from graph
 * @param   {Number} nodeId
 * @returns {Node}   Node object removed
 */
//var removeFromNodes = function (nodeId) {
//    var node = nodes.byId[nodeId];
//    if (!node) return null;
//    nodes.arr = nodes.arr.filter(function (n) { return n.uuid !== node.uuid });
//    delete nodes.byId[node.uuid];
//    delete nodes.byName[node.name];
//    return node;
//};

//var removeFromLinks = function (nodeId) {
//
//    // remove any links with node from array
//    links.arr = links.arr.filter(function (link) {
//        return link.sourceId !== nodeId && link.targetId !== nodeId
//    });
//
//    // remove any references by node id
//    delete links.byNodeIds[nodeId];
//    Object.keys(links.byNodeIds).forEach(function (sourceId) {
//        delete links.byNodeIds[sourceId][nodeId];
//    });
//
//};