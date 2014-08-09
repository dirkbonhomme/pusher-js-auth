/**
 * Pusher plugin for batching auth requests in one HTTP call
 * Kudos @pl https://gist.github.com/pl/685c4766b58a238309e8
 *
 * Copyright 2014, Dirk Bonhomme <dirk@bytelogic.be>
 * Released under the MIT licence.
 */
(function(Pusher){

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
            if(Pusher.Util.keys(this.requests).length){
                this.executeRequests();
                this.setRequestTimeout();
            }else{
                this.requestTimeout = null;
            }
        }.bind(this), this.options.authDelay || 0);
    };

    /**
     * Compose POST query
     *
     * @notice Override of original method signature by replacing socketId with requests argument
     */
    BufferedAuthorizer.prototype.composeQuery = function(requests){
        var i = 0;
        var query = '&socket_id=' + encodeURIComponent(this.options.socketId);
        for(var channel in requests){
            query += '&channel_name[' + i + ']=' + encodeURIComponent(channel);
            i++;
        }
        for(var param in this.authOptions.params) {
            query += '&' + encodeURIComponent(param) + '=' + encodeURIComponent(this.authOptions.params[param]);
        }
        return query;
    };

    /**
     * Execute all queued auth requests
     */
    BufferedAuthorizer.prototype.executeRequests = function(){
        var requests = this.requests;
        this.requests = {};
        Pusher.authorizers.ajax.call(this, requests, function(error, response){
            if(error){
                Pusher.Util.objectApply(requests, function(callback){
                    callback(true, response);
                });
            }else{
                Pusher.Util.objectApply(requests, function(callback, channel){
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
    Pusher.authorizers.buffered = function(socketId, callback){
        var authEndpoint = this.options.authEndpoint;
        var key = socketId + ':' + authEndpoint;
        var authorizer = authorizers[key];
        if(!authorizer){
            authorizer = authorizers[key] = new BufferedAuthorizer({
                socketId: socketId,
                authEndpoint: authEndpoint,
                authDelay: this.options.authDelay,
                authOptions: this.options.auth
            });
        }
        authorizer.add(this.channel.name, callback);
    };

})(window.Pusher);