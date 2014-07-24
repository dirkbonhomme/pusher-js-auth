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
        this.authEndpoint = options.authEndpoint;
        this.authDelay = options.authDelay || 0;
        this.authOptions = options.authOptions || {};
        this.requests = {};
        this.setRequestTimeout();
    };

    /**
     * Add auth request to queue and execute after delay
     */
    BufferedAuthorizer.prototype.add = function(socketId, channel, callback){
        this.requests[socketId] = this.requests[socketId] || {};
        this.requests[socketId][channel] = callback;
        if(!this.requestTimeout){
            this.setRequestTimeout();
        }
    };

    /**
     * Delay new requests and authenticate all of them after timeout
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
        }.bind(this), this.authDelay);
    };

    /**
     * Execute all queued auth requests
     */
    BufferedAuthorizer.prototype.executeRequests = function(){
        var requests = this.requests;
        this.requests = {};

        // Initialize xhr request
        var xhr = (window.XMLHttpRequest ? new window.XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP'));
        xhr.open('POST', this.authEndpoint, true);

        // Add custom request headers
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        for(var headerName in this.authOptions.headers){
            xhr.setRequestHeader(headerName, this.authOptions.headers[headerName]);
        }

        // Generate POST query
        var i = 0, query = '';
        for(var socketId in requests){
            for(var channel in requests[socketId]){
                query += '&socket_id[' + i + ']=' + encodeURIComponent(socketId) + '&channel_name[' + i + ']=' + encodeURIComponent(channel);
                i++;
            }
        }
        for(var param in this.authOptions.params) {
            query += '&' + encodeURIComponent(param) + '=' + encodeURIComponent(this.authOptions.params[param]);
        }

        xhr.onreadystatechange = function() {
            if(xhr.readyState !== 4){
                return;
            }

            if(xhr.status === 200){
                var response, parsed = false;

                try{
                    response = JSON.parse(xhr.responseText);
                    parsed = true;
                }catch(e){
                    Pusher.Util.objectApply(requests, function(channels){
                        Pusher.Util.objectApply(channels, function(callback){
                            callback(true, 'JSON returned from webapp was invalid, yet status code was 200. Data was: ' + xhr.responseText);
                        });
                    });
                }

                if(parsed){
                    Pusher.Util.objectApply(requests, function(channels, socketId){
                        Pusher.Util.objectApply(channels, function(callback, channel){
                            if(response[socketId] && response[socketId][channel]){
                                if(!response[socketId][channel].status || response[socketId][channel].status === 200){
                                    callback(null, response[socketId][channel].data); // successful authentication
                                }else{
                                    callback(true, response[socketId][channel].status); // authentication failed
                                }
                            }else{
                                callback(true, 404); // authentication string not returned
                            }
                        });
                    });
                }
            }else{
                Pusher.warn('Couldn\'t get auth info from your webapp', xhr.status);
                Pusher.Util.objectApply(requests, function(channels){
                    Pusher.Util.objectApply(channels, function(callback){
                        callback(true, xhr.status);
                    });
                });
            }
        };

        xhr.send(query);
    };

    /**
     * Add buffered authorizer to Pusher lib
     * Each endpoint gets its own buffered authorizer
     */
    var authorizers = {};
    Pusher.authorizers.buffered = function(socketId, callback){
        var authEndpoint = this.options.authEndpoint;
        var authorizer = authorizers[authEndpoint];
        if(!authorizer){
            authorizer = authorizers[authEndpoint] = new BufferedAuthorizer({
                authEndpoint: authEndpoint,
                authDelay: this.options.authDelay,
                authOptions: this.options.auth
            });
        }
        authorizer.add(socketId, this.channel.name, callback);
    };

})(window.Pusher);