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
 * Base class for counter custom html elements
 * 
 * subclasses must provide a _updateUi function for updating the UI
 */
class AbstractCounter extends HTMLElement {
    #value = 0;
    #max = 1;

    constructor() {
        super();

        this.addEventListener("dblclick", e => {
            e.stopPropagation();
            AbstractCounter.#popupEditor(this.#value, this.#max).then(({ max, value }) => {
                this.max = max;
                this.value = value;
            }).catch(err => { });
        });
    }

    static get observedAttributes() {
        return ['value', 'max'];
    }

    /**
     * Setter for the current value 
     */
    set value(x) {
        this.#value = Number.parseInt(x) || 0;
        this.setAttribute('value', this.#value);
        this._updateUi();
    }

    /**
     * Getter for the current value 
     */
    get value() {
        return this.#value;
    }

    /**
     * setter for the maximum value
     */
    set max(x) {
        this.#max = Number.parseInt(x) || 0;
        this.setAttribute('max', this.#max);
        this._updateUi();
    }

    /**
     * getter for the maximum value 
     */
    get max() {
        return this.#max;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            switch (name) {
                case 'value':
                    this.value = newValue;
                    break;
                case 'max':
                    this.max = newValue;
                    break;
            }
        }
    }

    /**
     * Add an overlay for editing value and max value for the counter
     * returning a promise returning the results or being rejected.
     * 
     * The result of a successful edit is an object containing value and max properties.
     */
    static #popupEditor(value, max) {
        return new Promise((resolve, reject) => {
            let overlay = document.createElement('div');
            overlay.classList.add('counter-editor-overlay');

            let editorGrid = document.createElement('div');
            editorGrid.classList.add('editor-grid');

            let valueLabel = document.createElement('div');
            valueLabel.classList.add('label', 'value');
            valueLabel.innerText = 'Value';
            editorGrid.appendChild(valueLabel);

            let valueInput = document.createElement('input');
            valueInput.classList.add('value');
            valueInput.type = 'number';
            valueInput.value = value;
            editorGrid.appendChild(valueInput);

            let maxLabel = document.createElement('div');
            maxLabel.classList.add('label', 'max');
            maxLabel.innerText = 'Maximum';
            editorGrid.appendChild(maxLabel);

            let maxInput = document.createElement('input');
            maxInput.classList.add('max');
            maxInput.type = 'number';
            maxInput.value = max;
            editorGrid.appendChild(maxInput);

            let okButton = document.createElement('button');
            okButton.classList.add('accept');
            okButton.innerText = 'Ok';
            okButton.addEventListener('click', (e) => {
                e.stopPropagation();
                resolve({ value: Number.parseInt(valueInput.value), max: Number.parseInt(maxInput.value) })
                overlay.remove();
            });
            editorGrid.appendChild(okButton);

            let cancelButton = document.createElement('button');
            cancelButton.classList.add('reject');
            cancelButton.innerText = 'Cancel';
            cancelButton.addEventListener('click', (e) => {
                e.stopPropagation();
                reject("editing canceled");
                overlay.remove();
            });
            editorGrid.appendChild(cancelButton);

            overlay.appendChild(editorGrid);

            // stop any events from reaching the body
            [
                'dblclick', 'click', 'mouseup', 'mousedown',
                'keydown', 'keypress', 'keyup'
            ].forEach(evt => {
                overlay.addEventListener(evt, e => { e.stopPropagation(); });
            });

            document.body.appendChild(overlay);
        });
    }

    /**
     * Update the css attributes 'underflow', 'overflow' and 'invalid' on node, give value val and maximum max
     * 
     * \returns an object containing entries value and max containing the adjusted values with 0 <= value <= max and max >= 1.
     */
    static SetCounterValueAttributes(node, val, max) {
        let value = val;

        if (value < 0) {
            node.setAttribute('underflow', 'underflow');
            value = 0;
        } else {
            node.removeAttribute('underflow');
        }

        let maximum = max;

        if (maximum < 1) {
            node.setAttribute('invalid', 'invalid');
            maximum = 1;
        } else {
            node.removeAttribute('invalid');
        }

        if (value > maximum) {
            value = maximum;
            node.setAttribute('overflow', 'overflow');
        } else {
            node.removeAttribute('overflow');
        }

        return { value: value, max: maximum };
    };

}

/**
 * Custom element for rendering a counter with a bar 
 */
class BarCounter extends AbstractCounter {
    #bar;
    #caption;

    static get observedAttributes() {
        return AbstractCounter.observedAttributes;
    }

    constructor() {
        super();

        const shadow = this.attachShadow({ mode: 'closed' });

        let style = document.createElement('style');
        style.textContent = `
.content {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    justify-content: center;
    align-content: center;
    min-height: 1.5em;
    max-height: 3em;
    min-width: 10em;
    border: 2px solid var(--border-color, black);
    background-color: var(--bar-background, unset);
    width: 100%;
    height: 100%;
    cursor: pointer;
}

.content>* {
    grid-column: 1;
    grid-row: 1;
}

.caption {
    margin: auto;
    z-index: 2;
}

.bar {
    background-color: var(--bar-color, green);
    color: var(--text-color, black);
    justify-self: start;
    z-index: 1;
}`;
        shadow.appendChild(style);

        let root = document.createElement('div');
        root.classList.add('content');

        this.#bar = document.createElement('div');
        this.#bar.classList.add('bar');
        root.appendChild(this.#bar);

        this.#caption = document.createElement('div');
        this.#caption.classList.add('caption');
        root.appendChild(this.#caption);

        shadow.appendChild(root);

        this._updateUi();
    }

    /**
     * Updates the ui: bar size and caption are modified
     */
    _updateUi() {
        let { value, max } = AbstractCounter.SetCounterValueAttributes(this, this.value, this.max);
        this.#bar.style.width = `${100 * value / max}%`;
        this.#caption.innerText = `${this.value} / ${this.max}`;
    }

}

/**
 * custom html element for rendering a counter with tokens 
 */
class TokensCounter extends AbstractCounter {

    #columns = Infinity;
    #container;
    #tokens = [];

    static get observedAttributes() {
        let result = AbstractCounter.observedAttributes;
        result.push('columns');
        return result;
    }

    constructor() {
        super();

        const shadow = this.attachShadow({ mode: 'closed' });

        let style = document.createElement('style');
        style.textContent = `
.content {
    display: grid;
    justify-content: center;
    align-content: start;
    width: 100%;
    height: 100%;
    gap: .5ex;
}

.token {
    --background-color-internal: var(--background-color-empty, unset);
    height: 1em;
    width: 1em;
}

.token:hover {
    --background-color-internal: var(--background-color-empty-hover, #0804);
}

.token.filled {
    --background-color-internal: var(--background-color-filled, #080);
}

.token.filled:hover {
    --background-color-internal: var(--background-color-filled-hover, #080a);
}

.content .token {
    border: 2px solid var(--border-color, black);
    background-color: var(--background-color-internal);
    cursor: pointer;
}`;
        shadow.appendChild(style);

        this.#container = document.createElement('div');
        this.#container.classList.add('content');
        shadow.appendChild(this.#container);

        this._updateUi();
    }

    /**
     * update the ui; token count, fill state and columns used are updated 
     */
    _updateUi() {
        let { value, max } = AbstractCounter.SetCounterValueAttributes(this, this.value, this.max);

        if (max < this.#tokens.length) {
            // too many tokens
            for (let i = max; i != this.#tokens.length; ++i) {
                this.#tokens[i].remove();
            }
            this.#tokens.splice(max);
        } else {
            // not enough tokens
            for (let i = this.#tokens.length; i != this.max; ++i) {
                let token = document.createElement('div');
                token.classList.add('token');
                token.title = (i + 1);

                token.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (i == 0) {
                        // special treatment for first token: disable, if already active
                        this.value = (this.value == 1 ? 0 : 1);
                    } else {
                        this.value = (i + 1);
                    }
                });

                this.#container.appendChild(token);
                this.#tokens.push(token);
            }
        }

        // update enabled tokens
        for (let i = 0; i != this.#tokens.length; ++i) {
            this.#tokens[i].classList.toggle('filled', i < value);
        }

        if (Number.isInteger(this.#columns)) {
            //this.#container.setAttribute("style", `grid-template-columns: repeat(${this.#lineWidth}, 2em); grid-auto-flow: rows;`);
            this.#container.style.setProperty('grid-template-columns', `repeat(${this.#columns}, 2em)`);
            this.#container.style.setProperty('grid-auto-flow', 'row');
        } else {
            // this.#container.setAttribute("style", `grid-auto-flow: columns;`);
            this.#container.style.removeProperty('grid-template-columns');
            // without the number of columns known, we want to add to the end of the row, not the start
            this.#container.style.setProperty('grid-auto-flow', 'column');
        }
    }

    /**
     * setter for the number of columns 
     */
    set columns(x) {
        let value = Number.parseInt(x);
        if (Number.isNaN(value)) {
            value = Infinity;
        }
        this.#columns = value;
        this.setAttribute('columns', value);
        this._updateUi();
    }

    /**
     * getter for the number of columns 
     */
    get columns() {
        return this.#columns;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            switch (name) {
                case 'columns':
                    this.columns = newValue;
                    break;
                default:
                    super.attributeChangedCallback.call(this, name, oldValue, newValue);
                    break;
            }
        }
    }
}

customElements.define("bar-counter", BarCounter);
customElements.define("token-counter", TokensCounter);
