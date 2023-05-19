**Note:** Explanations for some of the stuff in the JS code (you can delete this directory safely without affecting the functionality of the site).

## Factories

The `Factories` object contains objects for constructing, persisting, restoring and editing parts of the site. The property names of the `Factories` object match the `type` in the persisted JSON.

### Making an element editable

The `EditorFactory` property of individual factories can be set to a factory. This will allow for calling `StartEdit(<jQuery object of edited element>)`
passing an element to edit replacing the element with an element constructed using the `EditorFactory`. This element will be restored using the `EditorFactory`
with the data of the original element serialized by its own factory.

The `CompleteEdit` function of the editor's factory can be used to replace the editor element with an element constructed and restored by the original element's factory
using the date serialized with the editor's factory as data for the restoration of the original element.

## Serialization

Serialization logic is implemented in the `Serialize` function of the element factories. Those functions are only responsible for serializing the individual element, not for children.

Each serializable element has a `serializable-<n>` CSS class where `<n>` is the number of ancestors that are serializable. (This is used for recursive search for serializable elements.)

### JSON file structure

**Toplevel**
```
{
    "data": [ ...serialized objects... ]
}
```

**Serialized Object**
```
{
    "type": "<factory name>",
    "children" : [ ...serailized objects... ], // (optional)
    ...object-specific properties...
}
```

## localStorage

The last active dataset is stored with the `dataset` key.

Any datasets are stored using the `dataset-<dataset name>` keys.
