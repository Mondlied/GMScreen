/* 
GMScreen - Some website code for running an editor in the browser

Copyright(C) 2023 Fabian Klein

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301
USA
*/

const CREATE = false;
const RESTORE = true;

/**
 * The name of the dataset. "unspecified" is the default and will result in querying the user for the name
 */
var activeDatasetName = "unspecified";

/**
 * Does nothing but prevent further event propagation
 */
function StopPropagation(e) {
    e.stopPropagation();
}

/**
 * Creates the css for absolutely positioning an element.
 * 
 * @param {string} x        - the css to use for the horizontal position
 * @param {string} y        - the css to use for the vertical position
 * @param {Object} [css]    - an object containing additional css properties to add
 */
function PositionCss(x, y, css = {}) {
    css.position = "absolute";
    css.left = x;
    css.top = y;
    return css;
}

/**
 * @param {Object} e    - a jquery object to retrieve the info from 
 */
function GetSerializationDepth(e) {
    var classes = e.attr("class").split(/\s+/);
    var cl;
    classes.forEach(c => {
        if (c.startsWith("serializable-")) {
            cl = Number(c.slice("serializable-".length));
        }
    });
    return cl;
}


/**
 * Helper function for creating factories
 * 
 * @param self {Object}             - the object to initialize
 * @param typeName {string}         - the name to use for the type
 * @param createFn {Function}       - a function that given coordinates x and y of a click, depth and a bool indicating, if the element is created for restoring(true) or not (false), creates a html element
 * @param serializeFn {Function}    - a function that given the jQuery object for the object returns a json object containing the data
 * @param restoreFn {Function}      - a function that given the jQuery object created by this factory and the json data restores the element to its saved state
 */
function CreateFactory(self, typeName, createFn, serializeFn, restoreFn) {
    self.CreateImpl = createFn;
    self.SerializeImpl = serializeFn;
    self.Restore = restoreFn;
    self.Type = typeName;
}

const FactoryPrototype = {
    Create: function (x, y, depth, mode = CREATE) {
        var result = this.CreateImpl(x, y, depth, mode);
        if (typeof result != "undefined") {
            result
                .data("factory", this)
                .addClass("serializable-" + depth);
            return result;
        }
    },
    Serialize: function (element) {
        var result = this.SerializeImpl(element);
        if (typeof result != "undefined") {
            result.type = this.Type;
            return result;
        }
    },
    StartEdit(e) {
        if (typeof this.EditorFactory != "undefined") {
            var serializationDepth = GetSerializationDepth(e);
            if (typeof serializationDepth == "undefined") {
                throw new Error("element has no serialization depth");
            }
            var state = GetPersistedDataAsJsonRecursive(e, serializationDepth);
            var newElement = this.EditorFactory.Create(0, 0, serializationDepth, RESTORE);
            newElement.data("editedElementFactory", this);
            this.EditorFactory.Restore(newElement, state);
            e.replaceWith(newElement);
            if (this.EditorFactory.OnPostEditorInsert instanceof Function) {
                this.EditorFactory.OnPostEditorInsert(newElement);
            }
        }
    },
    CompleteEdit(e) {
        var editedElementFactory = e.data("editedElementFactory");
        if (typeof editedElementFactory == "undefined") {
            throw new Error("editedElementFactory data missing from edited element");
        }
        var serializationDepth = GetSerializationDepth(e);
        if (typeof serializationDepth == "undefined") {
            throw new Error("element has no serialization depth");
        }
        var state = GetPersistedDataAsJsonRecursive(e, serializationDepth);
        var newElement = editedElementFactory.Create(0, 0, serializationDepth, RESTORE);
        editedElementFactory.Restore(newElement, state);
        e.replaceWith(newElement);
    }
};

/**
 * Editor for caption on top of the block
 */
function BlockHeadingEditorFactory() {
    CreateFactory(this,
        "blockHeaderEditor",
        function () {
            var result = $("<input type='text' class='ui-widget-header block-header edit'></input>");
            var thisFactory = this;
            result.on('keypress', function (e) {
                if (e.which == 13) {
                    e.stopPropagation();
                    thisFactory.CompleteEdit($(this));
                }
            });

            return result;
        },
        function (e) {
            return { text: e.val() };
        },
        function (e, v) {
            var t = v.text;
            e.val((typeof t == "undefined") ? "" : t);
        }
    );
    this.OnPostEditorInsert = function (e) {
        e.trigger("focus");
    };
}

/**
 * Caption on top of a block
 */
function BlockHeadingFactory() {
    CreateFactory(this,
        "blockHeader",
        function () {
            var result = $("<h3 class='ui-widget-header block-header'>Title</h3>");
            var thisFactory = this;
            result.on("dblclick", function (e) {
                e.stopPropagation();
                thisFactory.StartEdit($(this));
            });
            return result;
        },
        function (e) {
            return { text: e.text() };
        },
        function (e, v) {
            var t = v.text;
            e.text((typeof t == "undefined") ? "" : t);
        }
    );
}

/**
 * A toplevel block
 * @class
 */
function BlockFactory() {
    CreateFactory(this,
        "block",
        function (x, y, depth, mode) {
            var e = $("<div class='ui-widget-content resizeable'></div>");
            if (mode === CREATE) {
                e.append(Factories.blockHeader.Create(0, 0, depth + 1, CREATE));
            }
            e.css(PositionCss(x, y, { width: "30em", height: "30ex" }));
            e.resizable().draggable();
            e.on("dblclick", StopPropagation);
            return e;
        },
        function (el) {
            var result = {};
            ["width", "height", "top", "left"].forEach(prop => {
                result[prop] = el.css(prop);
            });
            return result;
        },
        function (e, v) {
            var css = {
                position: "absolute",
            };

            ["width", "height", "top", "left"].forEach(prop => {
                const p = v[prop];
                if (typeof p != "undefined") {
                    css[prop] = p;
                }
            });
            e.css(css);

            var heading = v.heading;
            if (typeof heading != "undefined") {
                e.children("h3").text(heading);
            }
        });
};

var Factories = {};

[
    BlockFactory,
    BlockHeadingFactory,
    BlockHeadingEditorFactory
]
    .forEach(factory => {
        Object.assign(factory.prototype, FactoryPrototype);
        var f = new factory();
        Factories[f.Type] = f;
    });

Factories.blockHeader.EditorFactory = Factories.blockHeaderEditor;

function LogError(e) {
    console.warn(e);
};

function ThrowError(e) {
    throw new Error(e);
};

/**
 * @param parent {Object}           - a jquery object for the parent to add to
 * @param depth {Number}            - the depth of parent in the restoration hierarchy
 * @param data {Object}             - the json data to restore the element based on
 * @param reportError {Function}    - a function receiving a string with the error message, if an issue occurs
 */
function RestoreStateRecursive(parent, depth, data, reportError = LogError) {
    data.forEach(e => {
        const key = e.type;
        if (typeof key != "undefined") {
            var factory = Factories[key];
            if (typeof factory != "undefined") {
                var newElement = factory.Create(0, 0, depth, RESTORE);
                parent.append(newElement);
                factory.Restore(newElement, e);
                newElement.addClass("serializable-" + depth);

                // recursively restore child elements
                var chn = e.children;
                if (chn instanceof Array) {
                    RestoreStateRecursive(newElement, depth + 1, chn);
                } else if (typeof chn != "undefined") {
                    reportError(`non-array type ${typeof chn} found as children data element`);
                }
            } else {
                reportError(`factory type '${key}' is unknown; ignoring data element ${e}`);
            }
        }
    });
}

/**
 * Restores the state from localStorage
 * 
 * @param reportError {Function}    - a function receiving a string with the error message, if an issue occurs
 */
function RestoreState(reportError = LogError)
{
    var ds = localStorage.getItem("dataset");
    if (ds !== null) {
        activeDatasetName = ds;
    }

    var data = localStorage.getItem("dataset-" + activeDatasetName);
    if (data !== null) {
        var insertionRoot = $("body");
        var parsedData = {};
        try {
            parsedData = JSON.parse(data);
        } catch (err) {
            console.error(`error in dataset ${activeDatasetName}: ${err.message}`);
            return;
        }
        var data = parsedData.data;
        if (data instanceof Array) {
            try {
                RestoreStateRecursive(insertionRoot, 0, data, reportError);
                document.title = `GM Screen(${activeDatasetName})`;
            } catch (err) {
                reportError(`error restoring the data: ${err.message}\n   data: ${data}`)
                alert("error restoring the data; for details see the console");
            }
        }
    } else {
        console.log(`no data found for dataset '${activeDatasetName}'`)
    }
}

/**
 * @param element {Object}          - a jquery object for the object to serialize
 * @param depth {Number}            - the depth of the element serialized
 * @param reportError {Function}    - a function receiving a string with the error message, if an issue occurs
 */
function GetPersistedDataAsJsonRecursive(element, depth, reportError = ThrowError) {
    var factory = element.data("factory");
    if (typeof factory == "undefined") {
        reportError(`no factory attached to serializable element at depth ${depth}`);
    }

    var result = factory.Serialize(element);

    var children = element.children(".serializable-" + (depth + 1));

    if (children.length != 0) {
        var chData = [];
        children.each(function () {
            var childData = GetPersistedDataAsJsonRecursive($(this), depth + 1, reportError);
            if (typeof childData != "undefined") {
                chData.push(childData);
            }
        });
        if (chData.length != 0) {
            result.children = chData;
        }
    }
    return result;
}

/**
 * @param reportError {Function}    - a function receiving a string with the error message, if an issue occurs
 */
function GetPersistedDataAsJson(reportError = ThrowError)
{
    var obj = [];
    $("body>.serializable-0").each(function () {
        var persistResult = GetPersistedDataAsJsonRecursive($(this), 0, reportError);
        if (typeof persistResult != "undefined") {
            obj.push(persistResult);
        }
    });
    return JSON.stringify({ "data": obj });
}

/**
 * Start a download of the current data as file
 * 
 * Note: if the current data set is "unspecified", the user is asked to enter the name instead
 */
function PersistToFile()
{
    if (activeDatasetName === "unspecified") {
        PersistToChosenFile();
        return;
    }
    const blob = new Blob([GetPersistedDataAsJson()], {
        type: "application/json"
    });
    var url = URL.createObjectURL(blob);

    // temporarily create a link element for setting the name of the download file & trigger the download
    const tempLink = window.document.createElement('a');
    tempLink.href = url;
    tempLink.download = activeDatasetName + ".json";
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
}

/**
 * Save the current data to localStorage
 */
function PersistToLocalStorage() {
    try {
        localStorage.setItem("dataset-" + activeDatasetName, GetPersistedDataAsJson());
        localStorage.setItem("dataset", activeDatasetName);
    } catch (err) {
        console.error(`error persisting data to local storage: \n${err.message}`);
    }
}

/**
 * List the names of all data sets available in localStorage excluding the "dataset-" prefix
 */
function ListDatasets() {
    var result = [];
    for (var i = 0; i < localStorage.length; ++i) {
        var key = localStorage.key();
        if (key.startsWith("dataset-")) {
            result.push(key.slice("dataset-".length))
        }
    }
    return result;
}

/**
 * show a dialog for choosing the file name and download the file with the given name, if the Ok button is pressed
 */
function PersistToChosenFile() {
    var dialog = $("<div id='savedialog' title='Choose the File Name'>Choose the file name to save as (note: still saved to your Download dir)<div><input type='text' id='savedialoginput'></input></div></div>");

    $("body").append(dialog);
    dialog.dialog({
        buttons: [{
            text: "Ok",
            click: function () {
                var text = $("#savedialoginput").val();
                if (text.endsWith(".json")) {
                    text = text.slice(0, -4);
                }
                activeDatasetName = text;
                CloseContextMenu();

                PersistToFile();
            }
        }]
    })
        .on("click", StopPropagation) // prevent closing the dialog on interaction
        .on("dialogclose", function (e) { CloseContextMenu(); });

    $("#savedialoginput").val(activeDatasetName);
}

/**
 * close all popups/menus, ect. 
 */
function CloseContextMenu() {
    $("#contextmenu").remove();
    $("#savedialog").remove();
}

/**
 * create a context menu for the <body> element and place it at position x, y
 */
function CreateToplevelContextMenu(x, y) {
    var menu = $("<ul id='contextmenu'></ul>")
        .css(PositionCss(x, y));

    menu.append(
        $("<li><div>Save</div></li>").on("click", function (e) {
            CloseContextMenu();
            PersistToFile();

            // a dialog may be opened, if the file isn't
            e.stopPropagation();
        }),
        $("<li><div>Save As...</div></li>").on("click", function (e) {
            CloseContextMenu();
            PersistToChosenFile();

            // stop the event from closing the newly opened dialog
            e.stopPropagation();
        }),
        $("<li><div>Clear All Memory</div></li>").on("click", function () {
            CloseContextMenu();
            localStorage.clear();
        }),
    );
    menu.menu();
    return menu;
}

// -----------------------------------------------------------------------------
// initialization
$(function () {
    RestoreState();
    $("body").on("dblclick", function (e) {
        var e = Factories.block.Create(e.offsetX, e.offsetY, 0, CREATE);
        $("body").append(e)
    }).on("contextmenu", function (e) {
        e.stopPropagation();
        CloseContextMenu();
        $("body").append(CreateToplevelContextMenu(e.offsetX, e.offsetY));
        return false;
    }).on("click", function () {
        CloseContextMenu();
    });
    $(window).on("unload", function () {
        PersistToLocalStorage();
    });
});
