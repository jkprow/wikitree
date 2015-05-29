(function() {
    angular.module('wikitree.main').

        controller('mainController', ['$scope', 'init_state',
            function($scope, init_state) {

                //$scope.searchTerm = CurrentSession.searchTerm;

                var history, nodes, links;

                /**
                 * Node history
                 * @namespace
                 */
                history = {
                    // Private state for where we are,
                    // where we were,
                    // and where we've gone
                    currentId: init_state.history.currentId || undefined,
                    prevStack: init_state.history.prevStack || [],
                    nextStack: init_state.history.nextStack || [],

                    /**
                     * Set the currently selected graph node
                     * @param   {Number} nodeId
                     * @returns {Number} id of current node
                     */
                    setCurrentId: function (nodeId) {
                        // make sure we're not already here
                        if (history.currentId === nodeId) return null;
                        // as with browser history,
                        // when jumping to new page
                        // add current to prev stack
                        // and flush out next stack
                        if (history.currentId) {
                            history.prevStack.push(history.currentId);
                        }
                        history.nextStack = [];
                        history.currentId = nodeId;
                        return history.currentId;
                    },

                    /**
                     * Select the previous graph node as current
                     * @returns {Number} id of new current node
                     */
                    goBackward: function () {
                        if (!history.prevStack.length) return null;
                        history.nextStack.push(history.currentId);
                        history.currentId = history.prevStack.pop();
                        return history.currentId;
                    },

                    /**
                     * Select the next graph node as current
                     * @returns {Number} id of new current node
                     */
                    goForward: function () {
                        if (!history.nextStack.length) return null;
                        history.prevStack.push(history.currentId);
                        history.currentId = history.nextStack.pop();
                        return history.currentId;
                    },

                    /**
                     * Removes the specified node from history
                     * @param   {Number} nodeId
                     * @returns {Number} id of new current node
                     */
                    removeNode: function (nodeId) {

                        // expunge from past & future
                        history.prevStack = history.prevStack
                            .filter(function (id) { return id !== nodeId });
                        history.nextStack = history.nextStack
                            .filter(function (id) { return id !== nodeId });

                        // find a new current node
                        if (history.prevStack.length) {
                            // try previous first
                            history.currentId = history.prevStack.pop();
                        } else if (history.nextStack.length) {
                            // how about next
                            history.currentId = history.nextStack.pop();
                        } else {
                            // uh oh
                            history.currentId = null;
                        }

                        // we did what we could
                        return history.currentId;

                    },

                    /**
                     * Packages and exports all history state
                     * @returns {{currentId: Number, prevStack: Array, nextStack: Array}}
                     */
                    exportState: function () {
                        return {
                            currentId: history.currentId,
                            prevStack: history.prevStack,
                            nextStack: history.nextStack
                        }
                    },

                    /**
                     * Imports all history state
                     * @param {Number} state.currentId
                     * @param {Array}  state.prevStack
                     * @param {Array}  state.nextStack
                     */
                    importState: function (state) {
                        history.currentId = state.currentId;
                        history.prevStack = state.prevStack;
                        history.nextStack = state.nextStack;
                    },

                    /**
                     * Clears all history state
                     */
                    clearState: function () {
                        history.currentId = undefined;
                        history.prevStack = [];
                        history.nextStack = [];
                    }
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
                function Node(args) {
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
                 * Node collection
                 * @namespace
                 */
                nodes = {
                    // Private state for the array of nodes,
                    // and lookup hashes by nodeId
                    // and nodeName
                    arr   : init_state.nodes.arr    || [],
                    byId  : init_state.nodes.byId   || {},
                    byName: init_state.nodes.byName || {},

                    /**
                     * Add a new node to the graph
                     * @param   {Object} args (see class Node)
                     * @returns {Node}   created Node object
                     */
                    addNode: function (args) {
                        var node = new Node({
                            type: args.type,
                            name: args.name,
                            title: args.title,
                            query: args.query
                        });
                        nodes.arr.push(node);
                        nodes.byId[node.uuid] = node;
                        nodes.byName[node.name] = node;
                        return node;
                    },

                    /**
                     * Remove node with specified id from graph
                     * @param   {Number} nodeId
                     * @returns {Node}   Node object removed
                     */
                    removeNode: function (nodeId) {
                        var node = nodes.byId[nodeId];
                        if (!node) return null;
                        nodes.arr = nodes.arr.filter(function (n) { return n.uuid !== node.uuid });
                        delete nodes.byId[node.uuid];
                        delete nodes.byName[node.name];
                        return node;
                    },

                    /**
                     * Packages and exports all node state
                     * @returns {{arr: Array}}
                     */
                    exportState: function () {
                        return {
                            arr: nodes.arr
                        }
                    },

                    /**
                     * Imports all node state
                     * @param {Object} state
                     * @param {Array}  state.arr
                     */
                    importState: function (state) {
                        nodes.arr = state.arr;
                        nodes.byId = {};
                        nodes.byName = {};
                        nodes.arr.forEach(function (node) {
                            nodes.byId[node.uuid] = node;
                            nodes.byName[node.name] = node;
                        });
                    },

                    /**
                     * Clears all node state
                     */
                    clearState: function () {
                        nodes.arr = [];
                        nodes.byId = {};
                        nodes.byName = {};
                    }
                };


                /**
                 * Create a link object
                 * @param {Object}  args
                 * @param {String}  args.uuid      unique id.  Default: generate a new one
                 * @param {Number}  args.sourceId  id of source node
                 * @param {Number}  args.targetId  id of target node
                 * @param {Boolean} args.linkback  if link is cyclical
                 * @constructor
                 */
                function Link(args) {
                    this.uuid = args.uuid || Utilities.makeUUID();
                    this.sourceId = args.sourceId;
                    this.targetId = args.targetId;
                    this.linkback = false;
                    // d3 force graph attributes
                    // https://github.com/mbostock/d3/wiki/Force-Layout#links
                    this.source = nodes.byId[this.sourceId];
                    this.target = nodes.byId[this.targetId];
                }

                /**
                 * Link collection
                 * @namespace
                 */
                links = {
                    // Private state for the array of links,
                    // and lookup hashes by linkId
                    // and nodeId
                    arr      : init_state.links.arr       || [],
                    byId     : init_state.links.byId      || {},
                    byNodeIds: init_state.links.byNodeIds || {},

                    /**
                     * Add a link to the graph
                     * @param    {Number}  sourceId  id of source node
                     * @param    {Number}  targetId  id of target node
                     * @returns  {Link}    created Link object
                     */
                    addLink: function (sourceId, targetId) {
                        var link = new Link({
                            sourceId: sourceId,
                            targetId: targetId
                        });
                        links.arr.push(link);
                        if (!links.byNodeIds[sourceId]) links.byNodeIds[sourceId] = {};
                        links.byNodeIds[sourceId][targetId] = link;
                        links.byId[link.uuid] = link;
                        return link;
                    },

                    /**
                     * Remove a link from the graph based
                     * @param    {Number}  sourceId  id of source node
                     * @param    {Number}  targetId  id of target node
                     * @returns  {Link}    removed Link object
                     */
                    removeLink: function (sourceId, targetId) {
                        var link = links.byNodeIds[sourceId][targetId];
                        if (!link) return null;
                        links.arr = links.arr.filter(function (l) { return l.uuid !== link.uuid });
                        delete links.byNodeIds[sourceId][targetId];
                        delete links.byId[link.uuid];
                        return link;
                    },

                    /**
                     * Remove all links associated with a node
                     * @param  {Number}  nodeId  id of node
                     */
                    removeByNode: function (nodeId) {

                        // remove any links with node from array
                        links.arr = links.arr.filter(function (link) {
                            return link.sourceId !== nodeId && link.targetId !== nodeId
                        });

                        // remove any references by node id
                        delete links.byNodeIds[nodeId];
                        Object.keys(links.byNodeIds).forEach(function (sourceId) {
                            delete links.byNodeIds[sourceId][nodeId];
                        });

                    },

                    /**
                     * Packages and exports all link state
                     * @returns {{arr: Array}}
                     */
                    exportState: function () {
                        return {
                            arr: links.arr
                        }
                    },

                    /**
                     * Imports all link state
                     * @param {Object} state
                     * @param {Array}  state.arr
                     */
                    importState: function (state) {
                        links.arr = state.arr;
                        links.byId = {};
                        links.byNodeIds = {};
                        links.arr.forEach(function (link) {
                            var sourceId = link.sourceId;
                            var targetId = link.targetId;
                            link.source = nodes.byId[sourceId];
                            link.target = nodes.byId[targetId];
                            links.byId[link.uuid] = link;
                            if (!links.byNodeIds[sourceId]) links.byNodeIds[sourceId] = {};
                            links.byNodeIds[sourceId][targetId] = link;
                        });
                    },

                    /**
                     * Clears all link state
                     */
                    clearState: function () {
                        links.arr = [];
                        links.byId = {};
                        links.byNodeIds = {};
                    }
                };

                /**
                 * Get article data
                 * @param   {String} title
                 * @returns {Promise} Resolves to Article data
                 */
                function findOrAddArticle(title) {

                    // is this a category?
                    if (title.match(/^Category:/)) {
                        // skip to special handler
                        return findOrAddCategory(title);
                    }

                    return Articles.getByUnsafeTitle(title).
                        then(function (article) {
                            return{
                                type: 'article',
                                name: article.title,
                                title: article.title
                            };
                        }).
                        catch(function (err) {
                            console.log('In findOrAddArticle', err);
                            // no result? try searching
                            return findOrAddSearch(title);
                        });
                }

                /**
                 * Get category data
                 * @param title
                 * @returns {Promise} Resolves to category data
                 */
                function findOrAddCategory(title) {
                    return Categories.getByUnsafeTitle(title).
                        then(function (category) {
                            return {
                                type: 'category',
                                name: category.title,
                                title: category.title
                            };
                        }).
                        catch(function (err) {
                            console.log('In findOrAddCategory', err);
                            // no result? try searching
                            return findOrAddSearch(title);
                        });
                }

                /**
                 * Get search results
                 * @param {String} query
                 * @returns {Promise} Resolves to search results data
                 */
                function findOrAddSearch(query) {
                    return Searches.getByQuery(query).
                        then(function (search) {
                            return {
                                type: 'search',
                                name: 'Search "' + query + '"',
                                query: query
                            };
                        }).
                        catch(function (err) {
                            console.log('In findOrAddSearch', err);
                            // no dice
                            return null;
                        });
                }

                /**
                 * Find node in the current graph, add if not found
                 * @param {Object} args see class Node for details
                 * @param {Function} callback
                 */
                function findOrAddNode(args, callback) {
                    var node = nodes.byName[args.name];
                    if (!node) node = nodes.addNode(args);
                    callback(node);
                };

                /**
                 *Find link in the current graph, add if not found
                 * @param {Node} node
                 * @param {Number} sourceId
                 * @param {Function} callback
                 */
                function findOrAddLink(node, sourceId, callback) {
                    var targetId = node.uuid;

                    // wait lol, no self-referencing nodes
                    if (targetId === sourceId) {
                        callback(null);
                        return;
                    }

                    // TODO not sure where to put this
                    // give source coords to target node
                    var source = nodes.byId[sourceId];
                    if ((source.x || source.y) && !(node.x || node.y)) {
                        node.x = source.x + Utilities.makeJitter(10);
                        node.y = source.y + Utilities.makeJitter(10);
                    }

                    var link = null;
                    if (links.byNodeIds[sourceId] &&
                        links.byNodeIds[sourceId][targetId]) {
                        // grab existing link
                        link = links.byNodeIds[sourceId][targetId];
                    } else if (links.byNodeIds[targetId] &&
                        links.byNodeIds[targetId][sourceId]) {
                        // add new link, but mark as duplicate
                        link = links.addLink(sourceId, targetId);
                        link.linkback = true;
                    } else {
                        // add new link
                        link = links.addLink(sourceId, targetId);
                    }

                    callback(link);
                }

                /**
                 * Public interface
                 */
                return {

                    /**
                     * Read state
                     */

                    getCurrentNode: function () {
                        return nodes.byId[history.currentId];
                    },

                    getNodes: function () {
                        return nodes.arr;
                    },

                    getLinks: function () {
                        return links.arr;
                    },

                    hasForward: function () {
                        return !!history.nextStack.length;
                    },

                    hasBackward: function () {
                        return !!history.prevStack.length;
                    },

                    /**
                     * Change state
                     */

                    goForward: function () {
                        history.goForward();
                        $rootScope.$broadcast('update:currentnode');
                    },

                    goBackward: function () {
                        history.goBackward();
                        $rootScope.$broadcast('update:currentnode');
                    },

                    setCurrentNode: function (nodeId) {
                        history.setCurrentId(nodeId);
                        $rootScope.$broadcast('update:currentnode');
                    },

                    removeNode: function (nodeId) {

                        // validate existence
                        var node = nodes.byId[nodeId];
                        if (!node) return;

                        // remove from collections
                        nodes.removeNode(node.uuid);
                        links.removeByNode(node.uuid);
                        history.removeNode(node.uuid);

                        // alert the media
                        $rootScope.$broadcast('update:nodes+links');
                        $rootScope.$broadcast('update:currentnode');

                    },

                    handleTitle: function (args) {

                        var startTime = Date.now();

                        var title = args.title.trim();
                        var sourceNodeId = args.sourceNodeId; // add link from this node
                        var noSetCurrent = args.noSetCurrent; // bool, don't update current node

                        // must have title to handle title
                        if (!(title && title.length)) return;

                        // 1. find or add article
                        // 2. find or add node
                        // 3. find or add link (?)
                        // 4. set current node (?)

                        findOrAddArticle(title).
                            then(function (result) {

                                // TODO handle failure
                                if (!result) {
                                    alert('Sorry, something went wrong for "' + title + '"');
                                    return;
                                }

                                return findOrAddNode(result, function (node) {
                                    if (sourceNodeId) {
                                        findOrAddLink(node, sourceNodeId, function (link) {

                                            $rootScope.$broadcast('update:nodes+links');

                                            if (!noSetCurrent) {
                                                history.setCurrentId(node.uuid);
                                                $rootScope.$broadcast('update:currentnode');
                                            }

                                            var endTime = Date.now();
                                            console.log('handleTitle complete: ', endTime - startTime);

                                        });
                                    } else {

                                        $rootScope.$broadcast('update:nodes+links');

                                        if (!noSetCurrent) {
                                            history.setCurrentId(node.uuid);
                                            $rootScope.$broadcast('update:currentnode');
                                        }

                                        var endTime = Date.now();
                                        console.log('handleTitle complete: ', endTime - startTime);

                                    }
                                });
                            });
                    },

                    handleTitleSearch: function (args) {

                        // identical to handleTitle
                        // EXCEPT skips straight to search results

                        var startTime = Date.now();

                        var title = args.title.trim();
                        var sourceNodeId = args.sourceNodeId; // add link from this node
                        var noSetCurrent = args.noSetCurrent; // bool, don't update current node

                        // must have title to handle title
                        if (!(title && title.length)) return;

                        // 1. find or add article
                        // 2. find or add node
                        // 3. find or add link (?)
                        // 4. set current node (?)

                        findOrAddSearch(title).
                            then(function (result) {

                                // TODO handle failure
                                if (!result) {
                                    alert('Sorry, something went wrong for "' + title + '"');
                                    return;
                                }

                                return findOrAddNode(result, function (node) {
                                    if (sourceNodeId) {
                                        findOrAddLink(node, sourceNodeId, function (link) {

                                            $rootScope.$broadcast('update:nodes+links');

                                            if (!noSetCurrent) {
                                                history.setCurrentId(node.uuid);
                                                $rootScope.$broadcast('update:currentnode');
                                            }

                                            var endTime = Date.now();
                                            console.log('handleTitleSearch complete: ', endTime - startTime);

                                        });
                                    } else {

                                        $rootScope.$broadcast('update:nodes+links');

                                        if (!noSetCurrent) {
                                            history.setCurrentId(node.uuid);
                                            $rootScope.$broadcast('update:currentnode');
                                        }

                                        var endTime = Date.now();
                                        console.log('handleTitleSearch complete: ', endTime - startTime);

                                    }
                                });
                            });
                    },

                    /**
                     * Manage state
                     */

                    importState: function(session) {
                        session = session.data;

                        history.importState(session.history);
                        nodes.importState(session.nodes);
                        links.importState(session.links);

                        $rootScope.$broadcast('update:nodes+links');
                        $rootScope.$broadcast('update:currentnode');
                    },

                    exportState: function() {
                        return {
                            history: history.exportState(),
                            nodes: nodes.exportState(),
                            links: links.exportState()
                        }
                    },

                    clearState: function() {
                        history.clearState();
                        nodes.clearState();
                        links.clearState();

                        $rootScope.$broadcast('update:nodes+links');
                    }
                };

            }]);
})();