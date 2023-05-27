const RemoveAllChildNodes = (n) => {
    while (n.firstChild) {
        n.remove(n.firstChild);
    }
};

class CounterBase {
    #propertiesChangedListeners = [];
    #listenerCallInProgress = false;

    constructor() {
    }

    onPropertiesUpdated(current, max) {
        if (!this.#listenerCallInProgress) {
            this.#listenerCallInProgress = true;
            this.#propertiesChangedListeners.forEach((f) => {
                try {
                    f.call(this, current, max);
                } catch (err) {
                    console.error("error in listener\n" + err);
                }
            });
            this.#listenerCallInProgress = false;
        }
    }

    registerPropertiesChangedListener(l) {
        if (!(l instanceof Function)) {
            throw new TypeError(`expected a Function, but got ${l}`);
        }
        this.#propertiesChangedListeners.push(l);
    }

    unregisterPropertiesChangedListener(l) {
        let i = this.#propertiesChangedListeners.indexOf(l);
        if (i >= 0) {
            this.#propertiesChangedListeners.splice(i, 1);
        }
    }

    unregisterAllPropertiesChangedListeners() {
        this.#propertiesChangedListeners = [];
    }
}

class BarCounter extends CounterBase {
    // values
    #value;
    #max;

    // html elements
    #bar;
    #element;
    #inputMax;
    #inputValue;

    constructor(value = 0, max = 1) {
        super();
        if (value < 0) {
            throw new RangeError("value must be non-negative");
        }
        if (value > max) {
            throw new RangeError("value must not be greater than the max value");
        }
        this.#value = value;
        this.#max = max;
    }

    render()
    {
        if (!this.#element) {
            this.#element = document.createElement('div');
            this.#element.classList.add('bar-counter');

            // block event propagation
            ["click", "dblclick", "contextmenu"].forEach(e => {
                this.#element.addEventListener(e, ev => { ev.stopPropagation(); });
            });
        } else {
            RemoveAllChildNodes(this.#element);
        }

        this.#bar = document.createElement('div');
        this.#bar.classList.add('bar-counter-bar');

        this.#element.appendChild(this.#bar);

        let inputContainer = document.createElement('div');
        inputContainer.classList.add('bar-counter-inputs');

        this.#inputValue = document.createElement('input');
        this.#inputValue.type = 'number';
        this.#inputValue.addEventListener('input', () => {
            let num = Number.parseInt(this.#inputValue.value);
            if (!Number.isNaN(num)) {
                this.#value = num;
                this.#update_ui();
                this.onPropertiesUpdated(this.#value, this.#max);
            }
        });

        let inputSeparator = document.createElement('span');
        inputSeparator.innerText = '/';

        this.#inputMax = document.createElement('input');
        this.#inputMax.type = 'number';
        this.#inputMax.addEventListener('input', () => {
            let num = Number.parseInt(this.#inputMax.value);
            if (!Number.isNaN(num)) {
                this.#max = num;
                this.#update_ui();
                this.onPropertiesUpdated(this.#value, this.#max);
            }
        });

        inputContainer.appendChild(this.#inputValue);
        inputContainer.appendChild(inputSeparator);
        inputContainer.appendChild(this.#inputMax);

        this.#element.appendChild(inputContainer);

        this.#update_ui();

        return this.#element;
    }

    #update_ui() {
        if (this.#bar) {
            this.#bar.style.width = `${100 * this.#value / this.#max}%`;
            this.#inputValue.max = this.#max;
            this.#inputMax.min = this.#value;
            this.#inputValue.value = this.#value;
            this.#inputMax.value = this.#max;
        }
    }

    get value() {
        return this.#value;
    }

    set value(val) {
        val = Number(val);
        if (val > this.#max) {
            throw new RangeError(`the value must be <= max (${val} > ${this.#max})`);
        }
        if (val < 0) {
            throw new RangeError(`the value must be non-negative, but got ${val}`);
        }
        this.#value = val;
        this.#update_ui();
        this.onPropertiesUpdated(this.#value, this.#max);
    }

    get max() {
        return this.#max;
    }

    set max(val) {
        val = Number(val);
        if (val <= 0) {
            throw RangeError(`max must be positive, but got ${val}`);
        }
        this.#max = val;
        if (this.#value > val) {
            this.#value = val;
        }
        this.#update_ui();
        this.onPropertiesUpdated(this.#value, this.#max);
    }

    destroy() {
        this.unregisterAllPropertiesChangedListeners();
        this.#element.remove();
    }

}

class TokensCounter extends CounterBase {
    // values
    #value;
    #max;

    // html elements
    #tokens;
    #add;
    #subtract;
    #element;

    constructor(value = 0, max = 1) {
        super();
        if (value < 0) {
            throw new RangeError("value must be non-negative");
        }
        if (value > max) {
            throw new RangeError("value must not be greater than the max value");
        }
        this.#value = value;
        this.#max = max;
    }

    #createTokenElement() {
        let result = document.createElement('div');
        result.classList.add('token-counter-token');
        return result;
    }

    #createToken(index) {
        let result = this.#createTokenElement();

        var counter = this;

        result.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (this.classList.contains("filled")) {
                if ((index == 0) && (counter.value == 1)) {
                    counter.value = 0;
                } else {
                    counter.value = index + 1;
                }
            } else {
                counter.value = index + 1;
            }
        });
        return result;
    }

    render() {
        this.#tokens = [];

        if (!this.#element) {
            this.#element = document.createElement('div');
            this.#element.classList.add('token-counter');

            // block event propagation
            ["click", "dblclick", "contextmenu"].forEach(e => {
                this.#element.addEventListener(e, ev => { ev.stopPropagation(); });
            });
        } else {
            RemoveAllChildNodes(this.#element);
        }
        this.#subtract = this.#createTokenElement();
        this.#subtract.classList.add("subtract");
        this.#subtract.innerText = "-";
        this.#subtract.addEventListener("click", (e) => {
            try {
                this.max = this.#max - 1;
            } catch (err) {
            }
            e.stopPropagation();
        });
        this.#element.appendChild(this.#subtract);

        this.#add = this.#createTokenElement();
        this.#add.classList.add("add");
        this.#add.innerText = "+";
        this.#add.addEventListener("click", (e) => {
            this.max = this.#max + 1;
            e.stopPropagation();
        });
        this.#element.appendChild(this.#add);

        this.#update_tokens();
        return this.#element;
    }

    #update_tokens() {
        if (this.#tokens) {
            if (this.#max < this.#tokens.length) {
                // shrink token list
                for (let i = this.#max; i < this.#tokens.length; ++i) {
                    this.#tokens[i].remove();
                }
                this.#tokens.splice(this.#max);
            }

            let maxFilled = Math.min(this.#value, this.#tokens.length);
            let i = 0;
            for (; i < maxFilled; ++i) {
                this.#tokens[i].classList.add("filled");
            }
            for (; i < this.#tokens.length; ++i) {
                this.#tokens[i].classList.remove("filled");
            }

            for (let i = this.#tokens.length; i < this.#max; ++i) {
                // grow token list
                let token = this.#createToken(i);
                if (i < this.#value) {
                    token.classList.add("filled");
                }
                this.#tokens.push(token);
                //this.#element.insertBefore(token, this.#add);
                this.#element.appendChild(token);
            }
        }
    }

    get value() {
        return this.#value;
    }

    set value(val) {
        val = Number(val);
        if (val > this.#max) {
            throw new RangeError(`the value must be <= max (${val} > ${this.#max})`);
        }
        if (val < 0) {
            throw new RangeError(`the value must be non-negative, but got ${val}`);
        }
        if (!Number.isInteger(val)) {
            throw RangeError(`the value must be an integer, but got ${val}`);
        }
        this.#value = val;
        this.#update_tokens();
        this.onPropertiesUpdated(this.#value, this.#max);
    }

    get max() {
        return this.#max;
    }

    set max(val) {
        val = Number(val);
        if (val <= 0) {
            throw RangeError(`max must be positive, but got ${val}`);
        }
        if (!Number.isInteger(val)) {
            throw RangeError(`max must be an integer, but got ${val}`);
        }
        this.#max = val;
        if (this.#value > val) {
            this.#value = val;
        }
        this.#update_tokens();
        this.onPropertiesUpdated(this.#value, this.#max);
    }

    destroy() {
        this.unregisterAllPropertiesChangedListeners();
        this.#element.remove();
    }
}

const CounterDisplayTypes = {
    BarCounter: BarCounter,
    TokensCounter: TokensCounter
};

class Counter {

    #data;
    #settings;

    #counter;
    #counterDisplay;
    #label;
    #wrapper;
    #tunes = { };

    static get toolbox() {
        return {
            title: 'Counter',
            icon: '<div class="counter-toolbox" style="width: 17px; height: 17px; display: inline-block;">x/y</div>'
        };
    }

    validate(savedData) {
        return Number.isInteger(savedData.current)
            && Number.isInteger(savedData.max)
            && (savedData.current >= 0)
            && (savedData.max >= savedData.current)
            && (!savedData.display || (Object.keys(CounterDisplayTypes).indexOf(savedData.display) != -1));
    }

    constructor({ data }) {
        data.current = Number(data.current || 0);
        if (!(data.current >= 0)) { // note written this way because of NaN possibility
            data.current = 0;
        }
        data.max = Number(data.max || 1);
        if (!(data.max >= data.current)) {
            data.max = Math.min(data.current, 1);
        }

        data.display = (CounterDisplayTypes[data.display] || BarCounter).name;

        this.#data = data;
        this.#settings = [
            {
                name: 'TokensCounter',
                icon: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="8" fill="black" stroke="black" width="5" height="5"/><rect x="7.5" y="8" fill="black" stroke="black" width="5" height="5"/><rect x="14" y="8" fill="transparent" stroke="black" width="5" height="5"/></svg>`
            },
            {
                name: 'BarCounter',
                icon: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="8" stroke="black" fill="transparent" width="18" height="5"/><rect x="1" y="8" fill="black" width="8" height="5"/></svg>`
            }
        ];
    }

    render() {
        if (this.#wrapper) {
            this.#wrapper.innerHTML = "";
            this.#counter.destroy();
        } else {
            this.#wrapper = document.createElement("div");
            this.#wrapper.classList.add("counter-block");
        }

        if (this.#counter) {
            this.#counter.destroy();
        }

        let clazz = CounterDisplayTypes[this.#data.display ? this.#data.display : "BarCounter"] || BarCounter;
        this.#counter = new clazz();

        this.#label = document.createElement("div");
        this.#label.classList.add("label");
        this.#label.contentEditable = true;

        this.#label.innerHTML = this.#data && this.#data.text ? this.#data.text : "";

        this.#wrapper.appendChild(this.#label);
        this.#wrapper.appendChild(this.#counterDisplay = this.#counter.render());
        this.#counterDisplay.classList.add("display");
        this.#counter.max = this.#data.max;
        this.#counter.value = this.#data.current;

        return this.#wrapper;
    }

    save(blockContent) {
        return {
            display: this.#counter.constructor.name,
            text: this.#label.innerHTML || "",
            current: this.#counter.value,
            max: this.#counter.max,
        }
    }

    #toggleTune(tuneName) {
        if (tuneName == this.#counter.constructor.name) {
            // activate other instead
            this.#settings.forEach(tune => {
                if (tune.name != tuneName) {
                    tuneName = tune.name;
                }
            });
        }

        this.#data = this.save(this.#wrapper);
        this.#data.display = tuneName;

        this.render();

        this.#settings.forEach(tune => {
            let t = this.#tunes[tune.name];
            t.classList.toggle('cdx-settings-button--active', tuneName == tune.name);
        });
    }

    renderSettings() {
        const wrapper = document.createElement('div');

        this.#settings.forEach(tune => {
            let button = document.createElement('div');
            button.classList.add('cdx-settings-button');
            button.classList.toggle('cdx-settings-button--active', tune.name == this.#counter.constructor.name);
            button.innerHTML = tune.icon;

            button.addEventListener('click', () => {
                this.#toggleTune(tune.name);
            });

            wrapper.appendChild(button);
            this.#tunes[tune.name] = button;
        });
        return wrapper;
    }
}