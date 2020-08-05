/**
 * Pusher plugin for batching auth requests in one HTTP call
 *
 * Copyright 2016, Dirk Bonhomme <dirk@bytelogic.be>
 * Released under the MIT licence.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('pusher-js'));
  } else if (typeof define === 'function' && define.amd) {
      // AMD. Register as an anonymous module.
      define(['pusher-js'], factory);
  } else {
    // Browser globals (root is window)
    root.PusherBatchAuthorizer = factory(root.Pusher);
  }
}(typeof self !== 'undefined' ? self : this, function(Pusher){

    /**
     * Utility method: loop over object's key and call method f with each member
     */
    function objectApply(object, f) {
        for (var key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
                f(object[key], key, object);
            }
        }
    }

    /**
     * Compose POST query to auth endpoint
     */
    function composeQuery(requests, socketId, authOptions){
        authOptions = typeof authOptions === 'function' ? authOptions() : authOptions
        var i = 0;
        var query = '&socket_id=' + encodeURIComponent(socketId);
        for(var channel in requests){
            query += '&channel_name[' + i + ']=' + encodeURIComponent(channel);
            i++;
        }
        for(var param in authOptions.params) {
            query += '&' + encodeURIComponent(param) + '=' + encodeURIComponent(authOptions.params[param]);
        }
        return query;
    }

    /**
     * Execute XHR request to auth endpoint
     */
    function xhrRequest(requests, socketId, authOptions, authEndpoint, callback){
        authOptions = typeof authOptions === 'function' ? authOptions() : authOptions
        var xhr = Pusher.Runtime.createXHR();
        xhr.open('POST', authEndpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        for (var headerName in authOptions.headers) {
            xhr.setRequestHeader(headerName, authOptions.headers[headerName]);
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var data, parsed = false;
                    try {
                        data = JSON.parse(xhr.responseText);
                        parsed = true;
                    }
                    catch (e) {
                        callback(new Error('JSON returned from webapp was invalid, yet status code was 200. Data was: ' + xhr.responseText), { auth: '' });
                    }
                    if (parsed) {
                        callback(null, data);
                    }
                }
                else {
                    callback(new Error('Unable to retrieve auth string from auth endpoint - received status: ' + xhr.status), { auth: '' });
                }
            }
        };
        xhr.send(composeQuery(requests, socketId, authOptions));
    }

    /**
     * Buffered authorizer constructor
     */
    var BufferedAuthorizer = function(options){
        this.options = options;
        this.authOptions = options.authOptions || {};
        this.requests = {};
        this.setRequestTimeout();
    };

    /**
     * Add auth request to queue and execute after delay
     */
    BufferedAuthorizer.prototype.add = function(channel, callback){
        this.requests[channel] = callback;
        if(!this.requestTimeout){
            this.setRequestTimeout();
        }
    };

    /**
     * Set new delay and authenticate all queued requests after timeout
     */
    BufferedAuthorizer.prototype.setRequestTimeout = function(){
        clearTimeout(this.requestTimeout);
        this.requestTimeout = setTimeout(function(){
            if(Object.keys(this.requests).length){
                this.executeRequests();
                this.setRequestTimeout();
            }else{
                this.requestTimeout = null;
            }
        }.bind(this), this.options.authDelay || 0);
    };

    /**
     * Execute all queued auth requests
     */
    BufferedAuthorizer.prototype.executeRequests = function(){
        var requests = this.requests;
        this.requests = {};
        xhrRequest(requests, this.options.socketId, this.authOptions, this.options.authEndpoint, function(error, response){
            if(error){
                objectApply(requests, function(callback){
                    callback(true, response);
                });
            }else{
                objectApply(requests, function(callback, channel){
                    if(response[channel]){
                        if(!response[channel].status || response[channel].status === 200){
                            callback(null, response[channel].data); // successful authentication
                        }else{
                            callback(true, response[channel].status); // authentication failed
                        }
                    }else{
                        callback(true, 404); // authentication data for this channel not returned
                    }
                });
            }
        });
    };

    /**
     * Add buffered authorizer to Pusher lib
     * Each endpoint and socket id gets its own buffered authorizer
     */
    var authorizers = {};

    return function (channel, options) {
        return {
            authorize: function (socketId, callback) {
                var authEndpoint = options.authEndpoint;
                var key = socketId + ':' + authEndpoint;
                var authorizer = authorizers[key];
                if(!authorizer){
                    authorizer = authorizers[key] = new BufferedAuthorizer({
                        socketId: socketId,
                        authEndpoint: authEndpoint,
                        authDelay: options.authDelay,
                        authOptions: options.auth
                    });
                }
                authorizer.add(channel.name, callback);
            }
        }
    }
}));
