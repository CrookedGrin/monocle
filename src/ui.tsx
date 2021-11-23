import * as React from 'react'
import * as ReactDOM from 'react-dom'
import './ui.scss'
import '../dist/ui.css'
import '../node_modules/figma-plugin-ds/dist/figma-plugin-ds.css';
import { log } from './util'

interface IProps { }

interface IState {
    errorMsg?: string;
    isCollapsed: boolean;
    inspectEnabled: boolean;
    inspectInProgress: boolean;
    currentData: any;
    dataByNodeId: any;
    nameSpace: string;
    key: string;
    lastQuery: {
        nameSpace: string;
        key: string;
    }
}

class App extends React.Component<IProps, IState> {

    /**********************************
     * State management
     **********************************/

    state: IState = {
        isCollapsed: false,
        inspectEnabled: false,
        inspectInProgress: false,
        nameSpace: '',
        key: '',
        currentData: null,
        dataByNodeId: {},
        lastQuery: {
            nameSpace: '',
            key: '',
        }
    };

    /**********************************
     * Lifecycle
     **********************************/

    reset = () => {
        this.setState({
            inspectEnabled: false,
            inspectInProgress: false,
            currentData: null,
        })
    }

    // recursive
    mapData = (data: any, map: any) => {
        if (!data) return map;
        if (data.pluginData && data.pluginData !== "") {
            map[data.id] = data.pluginData;
        }
        if (data.childData) {
            for (let child of data.childData) {
                map = this.mapData(child, map);
            }
        }
        return map;
    }

    update = (payload: any) => {
        let dataById = this.mapData(payload, {});
        this.setState({
            dataByNodeId: dataById,
            currentData: payload,
            inspectInProgress: false,
            errorMsg: undefined
        });
        this.forceUpdate();
    }

    componentDidMount = () => {
        window.addEventListener("message", (event) => {
            const message = event.data.pluginMessage;
            const payload = message.payload;
            switch (message.type) {
                case "selection-update":
                case "data-update":
                    this.update(payload);
                    break;
                case "no-selection":
                    this.reset();
                    break;
                case "init":
                    this.setState({...payload});
                    break;
                case "error":
                    this.setState({errorMsg: payload});
                default:
                    break;
            }
        });

        const inputs = document.getElementsByClassName('header__input');
        for (let input of inputs) {
            //@ts-ignore
            input.addEventListener('keyup', ({ key }) => {
                if (key === "Enter") {
                    this.onInspect();
                }
            });
            input.addEventListener('blur', () => {
                this.onInspect();
            });
        };

        // Request selection validation
        parent.postMessage({
            pluginMessage: { type: 'initial-render'}
        }, '*');

    }


    /**********************************
     * Event handlers
     **********************************/

    onInspect = () => {
        if ((this.state.nameSpace === this.state.lastQuery.nameSpace)
            && (this.state.key === this.state.lastQuery.key)) {
            return;
        }
        this.setState({
            inspectInProgress: true,
            lastQuery: {
                nameSpace: this.state.nameSpace,
                key: this.state.key
            }
        }, this.forceUpdate);
        requestAnimationFrame(() => {
            parent.postMessage({
                pluginMessage: {
                    type: 'inspect',
                    payload: {
                        nameSpace: this.state.nameSpace,
                        key: this.state.key
                    }
                }
            }, '*')
        });
    }


    onExpandCollapse = () => {
        this.setState({ isCollapsed: !this.state.isCollapsed })
        if (this.state.isCollapsed) {
            parent.postMessage({
                pluginMessage: {
                    type: 'collapse-ui'
                }
            }, '*')
        } else {
            parent.postMessage({
                pluginMessage: {
                    type: 'expand-ui'
                }
            }, '*')
        }
    }

    onNamespaceChange = (e) => {
        this.setState({
            nameSpace: e.target.value
        }, this.forceUpdate);
        parent.postMessage({
            pluginMessage: {
                type: 'update-storage',
                payload: {
                    nameSpace: e.target.value,
                    key: this.state.key
                }
            }
        }, '*');
    }
    
    onKeyChange = (e) => {
        this.setState({
            key: e.target.value
        }, this.forceUpdate);
        parent.postMessage({
            pluginMessage: {
                type: 'update-storage',
                payload: {
                    nameSpace: this.state.nameSpace,
                    key: e.target.value
                }
            }
        }, '*');
    }

    onValueChange = (e) => {
        let value = e.target.value;
        const id = (e.target as HTMLInputElement).getAttribute('data-id');
        let map = { ...this.state.dataByNodeId };
        map[id] = value;
        this.setState({ dataByNodeId: map }, this.forceUpdate);
    }

    updateValue = (value, id) => {
        parent.postMessage({
            pluginMessage: {
                type: 'update-node',
                payload: {
                    id: id,
                    value: value,
                    nameSpace: this.state.nameSpace,
                    key: this.state.key
                }
            }
        }, '*');
    }

    onValueBlur = (e) => {
        (e.target as HTMLElement).classList.remove('editing');
        let value = e.target.value;
        const id = (e.target as HTMLInputElement).getAttribute('data-id');
        this.updateValue(value, id);
    }

    onValueKeyUp = (e) => {
        if (e.key === "Enter") {
            (e.target as HTMLElement).blur();
        }
    }



    /**********************************
     * Rendering
     **********************************/

    renderAddField = (value, id) => {
        return (
            <div className="node__add" 
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    target.classList.add('node__add--editing');
                    target.querySelector('input')?.focus();
                }}
            >
                <span className="node__add__button"></span>
                <input
                    className="node__value"
                    onFocus={(e) => {
                        const target = e.target as HTMLElement;
                        target.parentElement.classList.add('node__add--editing');
                        target.classList.add('editing');
                    }}
                    onBlur={(e) => {
                        const target = e.target as HTMLElement;
                        target.parentElement.classList.remove('node__add--editing');
                        target.classList.remove('node__add--editing');
                        this.onValueBlur(e);
                    }}
                    onKeyUp={this.onValueKeyUp}
                    onChange={this.onValueChange}
                    type="text"
                    value={value}
                    data-id={id}
                >
                </input>
            </div>
        );
    }

    renderNodeIcon = (type: string) => {
        let iconText: string = "";
        let iconType = type?.toLowerCase();
        switch (type) {
            case "TEXT":
                iconText = "T";
                break;
            case "VECTOR":
                iconText = "▱";
                break;
            case "ELLIPSE":
                iconText = "○";
                break;
            case "RECTANGLE":
                iconText = "▭";
                break;
            case "LINE":
                iconText = "─";
                break;
        }
        let iconClass = `icon icon--purple icon--${iconType}`;
        return <div className={iconClass}>{iconText}</div>
    }

    renderValue = (value, id) => {
        return (
            <input
                className="node__value"
                onFocus={(e) => { (e.target as HTMLElement).classList.add('editing') }}
                onBlur={this.onValueBlur}
                onKeyUp={this.onValueKeyUp}
                onChange={this.onValueChange}
                type="text"
                value={value}
                data-id={id}
            >
            </input>
        );
    }

    //recursive function to render the tree
    renderNode = (nodeData: any, depth: number) => {
        // log(depth, 'renderResult for ', nodeData);
        const childData: any[] = (nodeData && nodeData.childData) ? nodeData.childData : [];
        const id = nodeData.id;
        const value = this.state.dataByNodeId[id];
        const nodeClasses = depth === 0 ? 'node node--root' : 'node';
        const nameClasses = !!nodeData.pluginData ? 'node__name hasTooltip hasData' : 'node__name hasTooltip';
        return (
            <div className={nodeClasses} key={nodeData.id}>
                <div className="node__content">
                    {this.renderNodeIcon(nodeData.type)}
                    <span 
                        className={nameClasses} 
                        data-tooltip={nodeData.name}>
                            {nodeData.name}
                    </span>
                    {nodeData.pluginData &&
                        this.renderValue(value, nodeData.id)
                    }
                    {!nodeData.pluginData &&
                        this.renderAddField(value, nodeData.id)
                    }
                </div>
                {/* Recursion */}
                {childData.map((childData: any) => {
                    return this.renderNode(childData, depth + 1);
                })}
            </div>
        )
    }

    render() {
        return (
            <>
                <div className="App">
                    <div className="header">
                        <label className="input">
                            Namespace:
                            <input
                                id="inputNamespace"
                                onChange={this.onNamespaceChange}
                                type="text"
                                className="input__field header__input"
                                placeholder="Namespace"
                                value={this.state.nameSpace}
                            />
                        </label>
                        <label className="input">
                            Key:
                            <input
                                id="inputKey"
                                onChange={this.onKeyChange}
                                type="text"
                                className="input__field header__input"
                                placeholder="Key"
                                value={this.state.key}
                            />
                        </label>
                    </div>
                    <div className="content">
                        {this.state.errorMsg &&
                            <div className="message">
                                {this.state.errorMsg}
                            </div>
                        }
                        {!this.state.errorMsg && this.state.currentData &&
                            <div className="nodes">
                                {this.state.inspectInProgress &&
                                    <div className="loader"><span /><span /></div>
                                }
                                {!this.state.inspectInProgress &&
                                    this.renderNode(this.state.currentData, 0)
                                }
                            </div>
                        }
                    </div>
                </div>
            </>
        )
    }
}


ReactDOM.render(<App />, document.getElementById('react-page'))