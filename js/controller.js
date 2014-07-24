/**
 * @class
 *
 * The Controller manipulates the model on user input.
 * It is responsible for maintaining transformations.
 *
 * @constructor
 * @param {Global} global Current Global object
 */
function Controller(global) {
    /** @private */
    this.global = global;

    /** @private */
    this.transformers = [];
}

Controller.prototype.addView = function(view) {
    var cstf = new CollapseSequentialNodesTransformation(2);
    var tfr = new Transformer(view.getVisualModel());

    tfr.addTransformation(cstf, true);
    this.transformers.push(tfr);
    this.transform();
}

/**
 * Transforms the model through the listed transformations, in the order
 * provided in the list
 */
Controller.prototype.transform = function() {
    var transformers = this.transformers;

    // Revert each view to original (untransformed) state
    this.global.getViews().forEach(function(v) {
        var ovg = v.getVisualModel();
        v.revert();
        var nvg = v.getVisualModel();

        transformers.forEach(function(tfr) {
            if (tfr.getModel() === ovg)
                tfr.setModel(nvg);
        });
    });

    transformers.forEach(function(tfr) {
        tfr.transform();
    });
}

/**
 * Binds events to visual elements
 * 
 * @param  {d3.selection} nodes A D3 selection of the drawn nodes
 * @param  {d3.selection} hosts A D3 selection of the drawn hosts
 * @param  {jQuery.selection} lines A jQuery selection of the log lines
 * @param  {d3.selection} hh A D3 selection of the hidden hosts
 */
Controller.prototype.bind = function(nodes, hosts, lines, hh) {
    var controller = this;

    if (nodes) {
        nodes.on("click", function(e) {
            if (d3.event.shiftKey) {
                controller.transformers.forEach(function(tfr) {
                    var ct = tfr.getTransformations(function(t) {
                        return t.constructor == CollapseSequentialNodesTransformation;
                    }, true).forEach(function(t) {
                        t.toggleExemption(e.getNode());
                    });
                });

                controller.transform();
                controller.global.drawAll();
            }
        }).on("mouseover", function(e) {
            $("circle").filter(function(i, c) {
                return $(c).data("focus");
            }).attr("r", function() {
                return $(this).data("r");
            }).data("focus", false);

            $(this).find("circle").data({
                "focus": true
            }).attr({
                "r": $(this).find("circle").data("r") + 2
            });

            $(".event").text(e.getText());
            $(".fields").children().remove();
            if (!e.isCollapsed()) {
                var fields = e.getNode().getLogEvents()[0].getFields();
                var fieldText = "";
                for (var i in fields) {
                    var $f = $("<tr>", { "class": "field" });
                    var $t = $("<th>", { "class": "title" }).text(i + ":");
                    var $v = $("<td>", { "class": "value" }).text(fields[i]);

                    $f.append($t).append($v);
                    $(".fields").append($f);
                }
            }

            $(".focus").css({
                "color": $(".focus").data("fill"),
                "background": "",
                "width": "inherit"
            }).removeClass("focus");

            $(".reveal").removeClass("reveal");

            var $line = $("#line" + e.getId());
            var $parent = $line.parent(".line").addClass("reveal");

            $line.addClass("focus").css({
                "background": "transparent",
                "color": "white",
                "width": "calc(" + $line.width() + "px - 1em)"
            }).data("fill", e.getFillColor());

            $(".highlight").css({
                "width": $line.width(),
                "height": $line.height()
            });

            var top = parseFloat($line.css("top")) || 0;
            var ptop = parseFloat($parent.css("top")) || 0;
            var margin = parseFloat($line.css("margin-top")) || 0;
            var pmargin = parseFloat($parent.css("margin-top")) || 0;
            var offset = $(".log").offset().top;

            $(".highlight").css({
                "background": e.getFillColor(),
                "top": top + ptop + margin + pmargin + offset,
                "left": $line.offset().left - parseFloat($line.css("margin-left"))
            }).attr({
                "data-ln": e.getLineNumber()
            }).show();
        });
    }

    if (hosts) {
        hosts.on("mouseover", function(e) {
            $(".event").text(e.getText());
            $(".fields").children().remove();
        }).on("dblclick", function(e) {
            if (d3.event.shiftKey) {
                if (controller.transformers.length != 1)
                    return;

                var tfr = controller.transformers[0];

                // Remove hidden hosts
                var hh = tfr.getTransformations(function(t) {
                    return t.constructor == HighlightHostTransformation;
                });
                if (hh.length) {
                    var hiddenHosts = hh[hh.length - 1].getHiddenHosts();
                    hiddenHosts.forEach(function(h) {
                        controller.global.removeHiddenHost(h);
                    });
                }

                var existing = tfr.getTransformations(function(t) {
                    if (t.constructor == HighlightHostTransformation)
                        return t.getHosts()[0] == e.getHost();
                });

                if (existing.length) {
                    existing.forEach(function(t) {
                        tfr.removeTransformation(t);
                    });
                } else {
                    var hightf = new HighlightHostTransformation(e.getHost());
                    tfr.addTransformation(hightf);
                }

                controller.transform();

                // Add hidden hosts back
                hh = tfr.getTransformations(function(t) {
                    return t.constructor == HighlightHostTransformation;
                });
                if (hh.length) {
                    var hiddenHosts = hh[hh.length - 1].getHiddenHosts();
                    hiddenHosts.forEach(function(h) {
                        controller.global.addHiddenHost(h);
                    });
                }
            } else {
                controller.transformers.forEach(function(tfr) {
                    var hhtf = new HideHostTransformation(e.getHost());
                    controller.global.addHiddenHost(e.getHost());
                    tfr.addTransformation(hhtf);
                });

                controller.transform();
            }

            controller.global.drawAll();
        });
    }

    if (lines) {
        lines.unbind().on("mouseover", function() {
            var id = "#node" + $(this).data("id");
            $(id)[0].dispatchEvent(new MouseEvent("mouseover"));
        });
    }

    if (hh) {
        hh.on("dblclick", function(e) {
            controller.transformers.forEach(function(tfr) {
                var high = tfr.getTransformations(function(t) {
                    if (t.constructor == HighlightHostTransformation)
                        return t.getHiddenHosts().indexOf(e) > -1;
                });

                if (high.length) {
                    var hh = tfr.getTransformations(function(t) {
                        return t.constructor == HighlightHostTransformation;
                    });
                    var hiddenHosts = hh[hh.length - 1].getHiddenHosts();
                    hiddenHosts.forEach(function(h) {
                        controller.global.removeHiddenHost(h);
                    });

                    hh.forEach(function(t) {
                        tfr.removeTransformation(t);
                    });
                }

                tfr.removeTransformation(function(t) {
                    if (t.constructor == HideHostTransformation)
                        return t.getHost() == e;
                });
            });

            controller.transform();
            controller.global.removeHiddenHost(e);
            controller.global.drawAll();
        }).on("mouseover", function(e) {
            $(".event").text(e);
            $(".fields").children().remove();
        });
    }
}