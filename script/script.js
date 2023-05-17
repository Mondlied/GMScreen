const SERIALIZE_KEY = "serialize";

var datasetName = "unspecified";

function SerializeBlock(block)
{
    var result = {};
    result.type = "block";
    ["width", "height", "top", "left"].forEach(prop => {
        result[prop] = block.css(prop);
    });
    result.heading = $(block, "h3").text();
    return result;
}

function BlockCreator()
{
    this.Create = function (x, y) {
        var e = $("<div class='ui-widget-content resizeable serializable'><h3 class='ui-widget-header'>Title</h3></div>");
        e.css({
            position: "absolute",
            width: "30em",
            height: "30ex",
            top: y,
            left: x
        });
        e.resizable().draggable();
        e.data(SERIALIZE_KEY, SerializeBlock);
        return e;
    };
    this.Restore = function (e, v) {
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
    };
};

var Factories =
{
    "block": new BlockCreator()
};

function RestoreState()
{
    var ds = localStorage.getItem("dataset");
    if (ds !== null) {
        datasetName = ds;
    }

    var data = localStorage.getItem("dataset-" + datasetName);
    if (data !== null) {
        var insertionRoot = $("body");
        var parsedData = {};
        try {
            parsedData = JSON.parse(data);
        } catch (err) {
            console.error(`error in dataset ${datasetName}: ${err.message}`);
            return;
        }
        var data = parsedData.data;
        if (typeof data != "undefined") {
            try {
                data.forEach(e => {
                    const key = e.type;
                    if (typeof key != "undefined") {
                        var factory = Factories[key];
                        if (typeof factory != "undefined") {
                            var newElement = factory.Create(0, 0);
                            insertionRoot.append(newElement);
                            factory.Restore(newElement, e);
                        } else {
                            console.warn(`factory type '${key}' is unknown; ignoring data element ${e}`);
                        }
                    }
                });
            } catch (err) {
                console.error(`error restoring the data: ${err.message}\n   data: ${data}`);
                alert("error restoring the data; for details see the console");
            }
        }
    } else {
        console.log(`no data found for dataset '${datasetName}'`)
    }
}

function GetPersistedDataAsJson()
{
    var obj = [];
    $("body>.serializable").each(function () {
        obj.push($(this).data(SERIALIZE_KEY)($(this)));
    });
    return JSON.stringify({ "data": obj });
}

function PersistToFile(x, y)
{
    if (datasetName === "unspecified") {
        PersistToChosenFile(x, y);
        return;
    }
    const blob = new Blob([GetPersistedDataAsJson()], {
        type: "application/json"
    });
    var url = URL.createObjectURL(blob);

    // temporarily create a link element for setting the name of the download file & trigger the download
    const tempLink = window.document.createElement('a');
    tempLink.href = url;
    tempLink.download = datasetName + ".json";
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
}

function PersistToLocalStorage() {
    try {
        localStorage.setItem("dataset-" + datasetName, GetPersistedDataAsJson());
        localStorage.setItem("dataset", datasetName);
    } catch (err) {
        console.error(`error persisting data to local storage: \n${err.message}`);
    }
}

function PersistToChosenFile(x, y) {
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
                datasetName = text;
                CloseContextMenu();

                PersistToFile();
            }
        }]
    })
        .on("click", function (e) { e.stopPropagation(); }) // prevent closing the dialog on interaction
        .on("dialogclose", function (e) { CloseContextMenu(); });

    $("#savedialoginput").val(datasetName);
}

function CloseContextMenu() {
    $("#contextmenu").remove();
    $("#savedialog").remove();
}

function CreateContextMenu(x, y) {
    var menu = $("<ul id='contextmenu'></ul>").
        css({
            position: "absolute",
            left: x,
            top: y
        });
    menu.append(
        $("<li><div>Save</div></li>").on("click", function (e) {
            CloseContextMenu();
            PersistToFile(e.pageX, e.pageY);
            e.stopPropagation();
        }),
        $("<li><div>Save As...</div></li>").on("click", function (e) {
            CloseContextMenu();
            PersistToChosenFile(e.pageX, e.pageY);
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
