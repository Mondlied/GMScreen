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

/**
 * Base class for counter-related EditorJS inline tools 
 */
class CounterToolBase {
    #api
    #button
    #state
    #tag = 'token-counter';
    #icon;

    set state(state) {
        this.#state = state;

        this.#button.classList.toggle(this.#api.styles.inlineToolButtonActive, state);
    }

    get state() {
        return this.#state;
    }

    static get isInline() {
        return true;
    }

    constructor(api, tag, icon) {
        this.#api = api;
        this.#tag = tag;
        this.#icon = icon;
        this.#button = null;
        this.#state = false;
    }

    render() {
        this.#button = document.createElement('button');
        this.#button.innerHTML = this.#icon;
        this.#button.classList.add(this.#api.styles.inlineToolButton);
        return this.#button;
    }

    surround(range) {
        let selectedExistingElement = this.#findTagInRange(range);
        if (!selectedExistingElement) {
            selectedExistingElement = this.#api.selection.findParentTag(this.#tag.toUpperCase());
        }

        if (selectedExistingElement) {
            range.selectNode(selectedExistingElement);
            this.#unwrap(range, selectedExistingElement);
            return;
        }

        this.#wrap(range);
    }

    #wrap(range) {
        const selectedText = range.extractContents();

        const counter = document.createElement(this.#tag);

        let p = document.createElement('p');
        p.appendChild(selectedText);
        let text = p.innerText;

        // extract 'a/b' substing to use for initial values
        let [dummy, currentStr, maxStr] = (/(\d+)\s*\/\s*(\d+)/g.exec(text) || [null, '0', '1']);

        counter.max = Number(maxStr);
        counter.value = Number(currentStr);

        counter.style.display = 'inline-block';

        range.insertNode(counter);

        this.#api.selection.expandToTag(counter);
    }

    #unwrap(range, edit) {
        const text = document.createTextNode(`${edit.value} / ${edit.max}`);
        range.deleteContents();
        range.insertNode(text);
    }

    #findTagInRange(range) {
        let pos = range.startContainer;
        while (pos != range.endContainer) {
            if (pos instanceof Element) {
                if (pos.tagName == this.#tag.toUpperCase()) {
                    return pos;
                }
                let res = pos.querySelector(this.#tag);
                if (res) {
                    return res;
                }
            }
            pos = pos.nextSibling;
        }
        if (pos instanceof Element) {
            let res = pos.querySelector(this.#tag);
            if (res) {
                return res;
            }
        }
    }

    #findTagInSelection(selection) {
        for (let i = 0; i < selection.rangeCount; ++i) {
            let res = this.#findTagInRange(selection.getRangeAt(i));
            if (res) {
                return res;
            }
        }
    }

    checkState(selection) {
        let state = !!this.#findTagInSelection(selection);
        if (!state) {
            let tag = this.#api.selection.findParentTag(this.#tag.toUpperCase());
            if (tag) {
                state = true;
            }
        }
        this.state = state;
    }
}

/**
 * EditorJS tool for creating an inline token counter 
 */
class InlineTokenCounterTool extends CounterToolBase {

    constructor({ api }) {
        super(api,
            'token-counter',
            '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="8" fill="black" stroke="black" width="5" height="5"/><rect x="7.5" y="8" fill="black" stroke="black" width="5" height="5"/><rect x="14" y="8" fill="transparent" stroke="black" width="5" height="5"/></svg>');
    }

    static get sanitize() {
        return {
            'token-counter': {
                style: true,
                value: true,
                max: true,
                columns: true,
            }
        };
    }
}

/**
 * EditorJS tool for creating an inline bar counter 
 */
class InlineBarCounterTool extends CounterToolBase {

    constructor({ api }) {
        super(api,
            'bar-counter',
            '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="8" stroke="black" fill="transparent" width="18" height="5"/><rect x="1" y="8" fill="black" width="8" height="5"/></svg>');
    }

    static get sanitize() {
        return {
            'bar-counter': {
                style: true,
                value: true,
                max: true,
            }
        };
    }
}
