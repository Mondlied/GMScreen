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
 * @param self {Object}                     - the object to initialize
 * @param typeName {string}                 - the name to use for the type
 * @param createFn {Function}               - a function that given coordinates x and y of a click, depth and a bool indicating, if the element is created for restoring(true) or not (false), creates a html element
 * @param serializeFn {Function}            - a function that given the function to pass the result to, an array of promises and a jQuery object for the object calls the function with the data read before all the promises are done
 * @param restoreFn {Function}              - a function that given the jQuery object created by this factory and the json data restores the element to its saved state
 * @param createContextMenuFn {Function}    - a function that given the jQuery object created by this factory creates returns a context menu element
 */
function CreateFactory(self, typeName, createFn, serializeFn, restoreFn, createContextMenuFn = null) {
    self.CreateImpl = createFn;
    self.SerializeImpl = serializeFn;
    self.Restore = restoreFn;
    self.Type = typeName;
    self.CreateContextMenu = createContextMenuFn;
}

const FactoryPrototype = {
    Create: function (x, y, depth, mode = CREATE) {
        var result = this.CreateImpl(x, y, depth, mode);
        if (typeof result != "undefined") {
            result
                .data("factory", this)
                .addClass("serializable-" + depth);
            if (typeof this.EditorFactory != "undefined") {
                result.on("dblclick", this, function (e) {
                        e.stopPropagation();
                        e.data.StartEdit($(this));
                });
            }
            if (this.CreateContextMenu instanceof Function) {
                result.on("contextmenu", this, function (e) {
                    e.stopPropagation();
                    var contextMenu = e.data.CreateContextMenu($(this));
                    if (typeof contextMenu != "undefined") {
                        contextMenu
                            .attr("id", "contextmenu")
                            .css(PositionCss(e.pageX, e.pageY, { "z-index": 20 }));
                        $("body").append(contextMenu);
                        contextMenu.menu();
                    }
                    return false;
                });
            } else {
                result.on("contextmenu", function (e) {
                    e.stopPropagation();
                    return false;
                });
            }
            return result;
        }
    },
    Serialize: function (f, promises, element) {
        const type = this.Type;
        var result = this.SerializeImpl;
        if (result instanceof Promise) {
            var promise = new Promise((resolve, reject) => { })
        }
        this.SerializeImpl((data) => {
            if (typeof data != "undefined") {
                if (typeof data.type == "undefined") {
                    data.type = type;
                }
                f(data);
            }
        }, promises, element);
    },
    StartEdit(e) {
        CloseAllEditors();
        var editorFactory = this.EditorFactory;
        if (typeof editorFactory != "undefined") {
            var serializationDepth = GetSerializationDepth(e);
            if (typeof serializationDepth == "undefined") {
                throw new Error("element has no serialization depth");
            }
            var newElement = editorFactory.Create(0, 0, serializationDepth, RESTORE);
            newElement.data("editedElementFactory", this);

            // note: editorjs requires being part of the dom tree and being initialized to load the data
            PersistDataAsJsonRecursive((data) => {
                    e.replaceWith(newElement);
                    if (editorFactory.OnPostEditorInsert instanceof Function) {
                        editorFactory.OnPostEditorInsert(newElement, data);
                    } else {
                        editorFactory.Restore(newElement, data);
                    }
                }, e, serializationDepth);

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
        var newElement = editedElementFactory.Create(0, 0, serializationDepth, RESTORE);

        PersistDataAsJsonRecursive((data) => {
                editedElementFactory.Restore(newElement, data);
                e.replaceWith(newElement);
            }, e, serializationDepth);
    }
}

/**
 * Add events for text area submit
 * 
 * @param e {Object}    - the jquery of the object to modify
 * @param f {Object}    - the factory of the element
 */
function AddTextEditorSubmitEvents(e, f) {
    e.on('keypress', f, function (e) {
        if (e.which == 13) {
            e.stopPropagation();
            e.data.CompleteEdit($(this));
        }
    });
}

/**
 * Editor for caption on top of the block
 */
function BlockHeadingEditorFactory() {
    CreateFactory(this,
        "blockHeaderEditor",
        function () {
            var result = $("<input type='text' class='ui-widget-header block-header edit'></input>");
            AddTextEditorSubmitEvents(result, this);
            return result;
        },
        function (f, promises, e) {
            f({ text: e.val() });
        },
        function (e, v) {
            var t = v.text;
            e.val((typeof t == "undefined") ? "" : t);
        }
    );
    //this.OnPostEditorInsert = function (e, data) {
    //    var t = data.text;
    //    e.val((typeof t == "undefined") ? "" : t);
    //    e.trigger("focus");
    //};
}

/**
 * Caption on top of a block
 */
function BlockHeadingFactory() {
    CreateFactory(this,
        "blockHeader",
        function () {
            var result = $("<h3 class='ui-widget-header block-header'>Title</h3>");
            return result;
        },
        function (f, promises, e) {
            f({text: e.text() });
        },
        function (e, v) {
            var t = v.text;
            e.text((typeof t == "undefined") ? "" : t);
        }
    );
}

/**
 * @param e {Object}    - the element to remove
 */
function CreateRemoveMenuEntry(e) {
    return $("<li><div>Delete</div></li>").on("click", e, function (e) {
        CloseMenus();
        e.data.remove();
        e.stopPropagation();
    });
}

/**
 * A toplevel block
 * @class
 */
const BlockFactory = function() {
    CreateFactory(this,
        "block",
        function (x, y, depth, mode) {
            var e = $("<div class='ui-widget-content resizeable block'></div>");
            if (mode === CREATE) {
                e.append(Factories.blockHeader.Create(0, 0, depth + 1, CREATE));
                e.append(Factories.blockContent.Create(0, 0, depth + 1, CREATE));
            }
            e.css(PositionCss(x, y, { width: "30em", height: "30ex" }));
            e.resizable().draggable()
                .on("dblclick", StopPropagation)
                .on("dragstart", function () { $(this).css("z-index", 10); })
                .on("dragstop", function () { $(this).css("z-index", ""); });
            return e;
        },
        function (f, promises, el) {
            var result = {};
            ["width", "height", "top", "left"].forEach(prop => {
                result[prop] = el.css(prop);
            });
            f(result);
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
        },
        function (e) {
            var menu = $("<ul></ul>");

            menu.append(
                $("<li><div>Append Text</div></li>").on("click", e, function (e) {
                    var tgt = e.data;
                    CloseMenus();
                    var element = Factories.blockText.Create(0, 0, GetSerializationDepth(tgt) + 1, CREATE);
                    tgt.append(element);
                    
                    e.stopPropagation();
                }),
                CreateRemoveMenuEntry(e)
            );
            menu.menu();
            return menu;
        }
    );
}

/**
 * A block content
 * @class
 */
const BlockContentFactory = function () {
    CreateFactory(this,
        "blockContent",
        function (x, y, depth, mode) {
            var e = $("<div class='block-content'></div>");
            if (mode === CREATE) {
                e.append($("<p>...text...</p>"));
            }
            return e;
        },
        function (f, promises, el) {
            var blocks = [];

            el.children().each(function () {
                var tag = this.tagName.toLowerCase();
                if (tag != "p") {
                    throw new Error(`serialization not supported for <${tag}> element`);
                }
                blocks.push({
                    type: "paragraph",
                    data: {
                        text: $(this).text()
                    }
                });
            });

            // return editorjs data
            f({
                data: {
                    blocks: blocks
                }
            });
        },
        function (e, v) {
            if (typeof v.data == "undefined") {
                e.text("");
            } else {
                v.data.blocks.forEach(d => {
                    if (d.type != "paragraph") {
                        throw new Error(`unexpected editorjs type '${d.type}'`);
                    }
                    e.append($("<p></p>").text(d.data.text));
                });
            }
        }
    );
}

const CloseAllEditors = function() {
    $(".editor").each(function () {
        const ts = $(this);
        const factory = ts.data("factory");
        if (typeof factory != "undefined") {
            try {
                factory.CompleteEdit(ts);
            } catch (err) {
                console.warn(err);
            }
        }
    });
}

/**
 * A block text child
 * @class
 */
const BlockContentEditorFactory = function() {
    CreateFactory(this,
        "blockContentEditor",
        function () {
            return $("<div class='editor'></div>");
        },
        function (f, promises, el) {
            promises.push(el.data("editorjs_object").save()
                .then((data) => {
                    // note: cannot immediately restore the element in editing state, so go with the edited type
                    f({ data: data, type: el.data("editedElementFactory").Type });
                }));
        },
        function (e, v) {
            e.data("editorjs_object").render(v.data);
        }
    );
    this.OnPostEditorInsert = function (el, data) {
        el.data("editorjs_object",
            new EditorJS({
                tools: {
                    table: Table,
                    header: Header
                },
                holder : el[0],
                minHeight: 10,
                onReady: () => {
                    // don't allow element dragging to interfere with editing
                    $("#editorjs").on({
                        "click": StopPropagation,
                        "mousedown": StopPropagation,
                    });
                },
                autofocus: true,
                data: data.data
            }));
    };
}

/**
 * A object containing the various objects for providing the parts of the site with functionality
 */
var Factories = {};

[
    BlockFactory,
    BlockHeadingFactory,
    BlockHeadingEditorFactory,
    BlockContentFactory,
    BlockContentEditorFactory
]
    .forEach(factory => {
        Object.assign(factory.prototype, FactoryPrototype);
        var f = new factory();
        Factories[f.Type] = f;
    });

// set editors
Factories.blockHeader.EditorFactory = Factories.blockHeaderEditor;
Factories.blockContent.EditorFactory = Factories.blockContentEditor;


const LogError = function (e) {
    if (e instanceof Error) {
        console.warn(e.message);
    } else {
        console.warn(e);
    }
}

const ThrowError = function(e) {
    if (e instanceof Error) {
        throw e;
    } else {
        throw new Error(e);
    }
}

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
 * Indicates whether an asynchronous save operation is currently taking place 
 */
var saveInProgressCount = 0;

/**
 * @param f {Function}              - a function receiving the data object
 * @param promises {Array}          - an array of promises that need to be fulfilled to complete the save operation
 * @param element {Object}          - a jquery object for the object to serialize
 * @param depth {Number}            - the depth of the element serialized
 * @param reportError {Function}    - a function receiving a string with the error message, if an issue occurs
 */
function PersistDataAsJsonRecursive(f, element, depth, reportError = ThrowError) {
    var result = null;
    var promises = [];
    PersistDataAsJsonRecursiveImpl((data) => { result = data }, promises, element, depth, reportError);
    if (promises.length == 0) {
        f(result);
    } else {
        ++saveInProgressCount;
        Promise.allSettled(promises)
            .then(() => {
                try {
                    f(result);
                } catch (err) {
                    try {
                        reportError(err);
                    } catch (e) {
                        console.error(e);
                    }
                }
            })
            .catch((err) => {
                try {
                    reportError(err);
                } catch (e) {
                    console.error(e);
                }
            })
            .finally(() => { --saveInProgressCount; });
    }
}

/**
 * Helper function for use in PersistDataAsJsonRecursive exclusively
 */
function PersistDataAsJsonRecursiveImpl(f, promises, element, depth, reportError) {
    var factory = element.data("factory");
    if (typeof factory == "undefined") {
        reportError(`no factory attached to serializable element at depth ${depth}`);
    }

    var children = element.children(".serializable-" + (depth + 1));

    if (children.length != 0) {
        var chData = [];
        var i = 0;
        children.each(function () {
            // reserve space for inserting the data
            const index = chData.length;
            chData.push(null);

            PersistDataAsJsonRecursiveImpl((data) => { chData[index] = data; }, promises, $(this), depth + 1, reportError);
        });
        factory.Serialize((data) => {
            data.children = chData;
            f(data);
        }, promises, element);
    } else {
        factory.Serialize(f, promises, element);
    }
}

/**
 * @param reportError {Function}    - a function receiving a string with the error message, if an issue occurs
 */
function PersistDataAsJson(save, reportError = ThrowError)
{
    var obj = [];
    var promises = [];
    $("body>.serializable-0").each(function () {
        const index = obj.length;
        obj.push(null);
        PersistDataAsJsonRecursiveImpl((data) => { obj[index] = data }, promises, $(this), 0, reportError);
    });
    if (promises.length == 0) {
        try {
            save(JSON.stringify({ data: obj }));
        }
        catch (err) {
            reportError(`error persisting the data: ${err.message}`);
        }
    } else {
        ++saveInProgressCount;
        Promise.allSettled(promises)
            .then(() => {
                --saveInProgressCount; // cancel save early, since the save function could call persistence functions again
                try {
                    save(JSON.stringify({ data: obj }));
                }
                catch (err) {
                    console.error(`error persisting the data: ${err.message}`);
                }
            })
            .catch((err) => {
                --saveInProgressCount; // cancel save early, since the reportError function could call persistence functions again
                try {
                    reportError(err);
                } catch (e) {
                    console.error(e);
                }
            });
    }
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
    PersistDataAsJson(function (data) {
        const blob = new Blob([data], {
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
    });
}

/**
 * Save the current data to localStorage
 * 
 * @param postSave {Function}   - an optional operation to execute the save is done
 */
function PersistToLocalStorage() {
    try {
        PersistDataAsJson((data) => {
            localStorage.setItem("dataset-" + activeDatasetName, data);
            localStorage.setItem("dataset", activeDatasetName);
        });
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
                CloseMenus();

                PersistToFile();
            }
        }]
    })
        .on("click", StopPropagation) // prevent closing the dialog on interaction
        .on("dialogclose", function (e) { CloseMenus(); });

    $("#savedialoginput").val(activeDatasetName);
}

/**
 * close all popups/menus, ect. 
 */
function CloseMenus() {
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
            CloseMenus();
            PersistToFile();

            // a dialog may be opened, if the file isn't
            e.stopPropagation();
        }),
        $("<li><div>Save As...</div></li>").on("click", function (e) {
            CloseMenus();
            PersistToChosenFile();

            // stop the event from closing the newly opened dialog
            e.stopPropagation();
        }),
        $("<li><div>Clear All Memory</div></li>").on("click", function () {
            CloseMenus();
            localStorage.clear();
        }),
    );
    menu.menu();
    return menu;
}

function FileDragOver(evt) {
    if ((evt.dataTransfer != null) && (evt.dataTransfer.items.length == 1)) {
        evt.preventDefault();
    }
}

function ReadDroppedFile(evt) {
    if ((evt.dataTransfer != null) && (evt.dataTransfer.files.length == 1)) {
        var file = evt.dataTransfer.files.item(0);

        const re = /^(?:.*[/\\])?([^/\\]*)(\.json)$/gi
        var fileName = re.exec(file.name)[1];

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var droppedData = JSON.parse(e.target.result);
                var data = droppedData.data;

                if (data instanceof Array) {
                    activeDatasetName = fileName;
                    $("body>*").remove();
                    RestoreStateRecursive($("body"), 0, data, reportError);
                    document.title = `GM Screen(${activeDatasetName})`;
                } else {
                    console.error("dropped file content does not contain a array property 'data'");
                }
            } catch (err) {
                console.error(`error loading dropped file: ${err.message}`);
            }
        };
        reader.readAsText(file);
        evt.preventDefault();
    }
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
        CloseMenus();
        $("body").append(CreateToplevelContextMenu(e.offsetX, e.offsetY));
        return false;
    }).on("click", function () {
        CloseMenus();
    });
    $(window).on("beforeunload", function (e) {
        PersistToLocalStorage();
        if (saveInProgressCount > 0) {
            if (window.confirm("Edit in progress; unable to save the data. Exit nonetheless?")) {
                console.log("the user decided to ignore data loss on page close");
            } else {
                console.log("preventing page close, since data could not be saved synchronously");
                e.preventDefault(); // delay until saving is done
                CloseAllEditors();
            }
        }
    });
});
