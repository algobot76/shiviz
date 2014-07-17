/**
 * LogParser can be used to transform raw log text to LogEvents The LogParser
 * class per se is only responsible for dividing the raw text into different
 * executions according to the supplied delimiter. It then creates one
 * ExecutionParser for each execution to which to task for parsing is then
 * delegated.
 * 
 * The raw log potentially contains text for multiple executions. Delimiters
 * demarcate where one execution's text ends and another begins. Labels can be
 * given to executions by specifying a "trace" capture group within the
 * delimiter regex. (So the label text must be part of the delimiter). This
 * label can later be used to identify an execution. If an execution's text is
 * not preceeded by a delimiter, it is given the empty string as its label.
 * 
 * @class
 * @constructor
 * @param {String} rawString The raw log text
 * @param {NamedRegExp} delimiter A regex that specifies the delimiter. Anything
 *        that matches the regex will be treated as a delimiter. A delimiter
 *        acts to separate different executions.
 * @param {NamedRegExp} delimiter A regex that specifies the log parser. The parser
 *        must contain the named capture groups "clock", "event", and "host"
 *        representing the vector clock, the event string, and the host
 *        respectively.
 */
function LogParser(rawString, delimiter, regexp) {

    /** @private */
    this.rawString = rawString.trim();

    /** @private */
    this.delimiter = delimiter;

    /** @private */
    this.regexp = regexp;

    /** @private */
    this.labels = [];

    /** @private */
    this.executions = {};

    if (this.delimiter != null) {
        var currExecs = this.rawString.split(this.delimiter.no);
        var currLabels = [ "" ];

        if (this.delimiter.names.indexOf("trace") >= 0) {
            var match;
            while (match = this.delimiter.exec(this.rawString)) {
                currLabels.push(match.trace);
            }
        }

        for (var i = 0; i < currExecs.length; i++) {
            if (currExecs[i].trim().length > 0) {
                this.executions[currLabels[i]] = new ExecutionParser(currExecs[i], currLabels[i], regexp);
                this.labels.push(currLabels[i]);
            }
        }
    } else {
        this.labels.push("");
        this.executions[""] = new ExecutionParser(this.rawString, "", regexp);
    }
}

/**
 * Gets all of the labels of the executions. The ordering of labels in the
 * returned array is guarenteed to be the same as the order in which they are
 * encountered in the raw log text
 * 
 * @returns {Array<String>} An array of all the labels.
 */
LogParser.prototype.getLabels = function() {
    return this.labels.slice();
};

/**
 * Returns the LogEvents parsed by this. The ordering of LogEvents in the
 * returned array is guaranteed to be the same as the order in which they were
 * encountered in the raw log text
 *
 * @param {String} label The label of the execution you want to get log events from.
 * @returns {Array} An array of LogEvents
 */
LogParser.prototype.getLogEvents = function(label) {
    if (!this.executions[label]) return null;
    return this.executions[label].logEvents;
};

/**
 * ExecutionParser parses the raw text for one execution.
 * 
 * @class
 * @constructor
 * @private
 * @param {String} rawString The raw string of the execution's log
 * @param {Label} label The label that should be associated with this execution
 * @param {NamedRegExp} regexp The RegExp parser
 * @returns
 */
function ExecutionParser(rawString, label, regexp) {

    /** @private */
    this.rawString = rawString;

    /** @private */
    this.label = label;

    /** @private */
    this.timestamps = [];

    /** @private */
    this.logEvents = [];

    var match;
    while (match = regexp.exec(rawString)) {
        var newlines = rawString.substr(0, match.index).match(/\n/g);
        var ln = newlines ? newlines.length + 1 : 1;

        var clock = match.clock;
        var host = match.host;
        var event = match.event;

        var fields = {};
        regexp.names.forEach(function(name, i) {
            if (name == "clock" || name == "host" || name == "event")
                return;

            fields[name] = match[name];
        });

        var timestamp = parseTimestamp(clock, host);
        this.timestamps.push(timestamp);
        this.logEvents.push(new LogEvent(event, timestamp, ln, fields));
    }

    function parseTimestamp(clockString, hostString) {
        try {
            clock = JSON.parse(clockString);
        } catch (err) {
            console.log(clockString);
            var exception = new Exception("An error occured while trying to parse the vector timestamp on line " + (line + 1) + ":");
            exception.append(text, "code");
            exception.append("The error message from the JSON parser reads:\n");
            exception.append(err.toString(), "italic");
            exception.setUserFriendly(true);
            throw exception;
        }

        try {
            var ret = new VectorTimestamp(clock, hostString);
            return ret;
        } catch (exception) {
            exception.prepend("An error occured while trying to parse the vector timestamp on line " + (line + 1) + ":\n\n");
            exception.append(text, "code");
            exception.setUserFriendly(true);
            throw exception;
        }
    }

}
