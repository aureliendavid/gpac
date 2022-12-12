import { editableInputTypes } from "@testing-library/user-event/dist/utils";
import React, {Component} from "react"
import { useState } from 'react';




const val2enum = (value, enumvals) => {

    if (enumvals && typeof(value) == "number" && value < enumvals.length) {
        return enumvals[value];
    }

    return value;

};

function GPACDetailsValue(props) {

    if (typeof(props.value) == "boolean") {
        return (
            <input type="checkbox" checked={props.value} disabled={true} />
        )
    }
    if (props.value == null) {
        return (null)
    }

    var value = props.value;

    if (props.enumvals) {
        value = val2enum(props.value, props.enumvals);
    }
    return (JSON.stringify(value))
}

function FilterInfos(props) {

    const infos = (index, propname, value) => {

        let exclude = ['gpac_args', 'ipid', 'opid' ];

        if (!exclude.includes(propname)) {
            return (
                <tr key={index}><td>{propname}</td><td><GPACDetailsValue value={value}/></td></tr> // add unique key
            );
        }
    };

    return (
        <div>
        <table id="filter_table">
            <thead>
                <tr>
                <th>name</th>
                <th>value</th>
                </tr>
            </thead>
            <tbody id="filter_tbody">
                { Object.keys(props.filter).map( (key, index) => infos(index, key, props.filter[key]) ) }
            </tbody>
        </table>
    </div>
    );

}



function Editable(props) {
    const [isEditing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");

    const handleChange = (event) => {

        if (event.target.hasOwnProperty("checked"))
            setEditValue(event.target.checked);
        else
            setEditValue(event.target.value);
    };

    const saveEdit = (event) => {
        setEditing(false);

        var sendValue = editValue;
        if (typeof(props.arg.value) == "object") {
            try {
                sendValue = JSON.parse(sendValue);
            }
            catch (e) {
                console.log("JSON parse error: ", e, "on value ", sendValue);
            }
        }
        props.onArgumentUpdated(sendValue);
    };

    const editWidget = () => {

        if (props.enumvals) {

            return (
                <select onChange={handleChange} defaultValue={ val2enum(props.arg.value, props.enumvals) }>
                    { props.enumvals.map( (option, index) => {
                        return ( <option key={index} value={option}>{option}</option>)
                    } ) }
                </select>
            )
        }

        if (typeof(props.arg.value) == "boolean") {
            return (
                <input key={props.arg.name + "editing"} type="checkbox" onChange={handleChange} defaultChecked={props.arg.value}  />
            )
        }

        return (
            <input type="text" onChange={handleChange} defaultValue={JSON.stringify(props.arg.value)}></input>
        );

    }

    if (isEditing) {
        return (
            <div>
                {/* <input type="text" onChange={handleChange} defaultValue={JSON.stringify(props.arg.value)}></input> */}
                {editWidget()}
                <a href="#" className="argsbtn" onClick={saveEdit}> ✅</a>
                <a href="#" className="argsbtn" onClick={()=>setEditing(false)}> ❌</a>
            </div>
        );
    } else {
        return (
            <span><GPACDetailsValue value={props.arg.value} enumvals={props.enumvals}/> <a href="#" className="argsbtn" onClick={()=> { setEditValue(props.arg.value) ; setEditing(true); }}>🖉</a></span>
        )
    }
}

function FilterArgs(props) {




    const editable = (argument, enumvals) => {
        if (argument['update']) {
            return <Editable arg={argument} enumvals={enumvals} onArgumentUpdated={ (newValue) => { props.onArgumentUpdated(argument['name'], newValue) } } />
        } else {
            return <GPACDetailsValue value={argument['value']} enumvals={enumvals} />
        }
    }

    const infos = (index, value) => {

        var enumvals = null;

        if ("min_max_enum" in value) {
            let mme = value['min_max_enum'];
            if (mme.includes('|')) {

                enumvals = mme.split('|');

            }
        }


        return (
            <tr key={index}><td title={value['desc']}>{value['name']}</td><td>{editable(value, enumvals)}</td></tr> // add unique key
        );

    };

    return (
        <div>
        <div className="details_header">arguments</div>
        <table id="args_table">
            <thead>
                <tr>
                <th>name</th>
                <th>value</th>
                </tr>
            </thead>
            <tbody id="args_tbody">
            { props.filter['gpac_args'].map( (value, index) => infos(index, value) ) }
            </tbody>
        </table>
        </div>
    );

}



function FilterPids(props) {

    const pid = (pidindex, pidname, pidobj) => {


        return (
            <tbody key={pidindex}>
                <tr>
                    <td colSpan="2" className="pidname_td">{pidname}</td>
                </tr>
                { Object.keys(pidobj).map( (pidprop, i) => (
                    <tr  key={i}>
                        <td>{pidprop}</td><td><GPACDetailsValue value={pidobj[pidprop]['val']}/></td>
                    </tr>
                ) ) }
            </tbody>

        );

    };

    return (
        <div>
            <div id="ipid_div" >
                <hr />
                <div className="details_header">input pids</div>
                <table id="ipid_table">
                    { Object.keys(props.filter['ipid']).map( (key, index) => pid(index, key, props.filter['ipid'][key]) ) }
                </table>
            </div>
            <div id="opid_div" >
                <hr />
                <div className="details_header">output pids</div>
                <table id="opid_table">
                    { Object.keys(props.filter['opid']).map( (key, index) => pid(index, key, props.filter['opid'][key]) ) }
                </table>
            </div>
        </div>
    );

}

export default class FilterDetails extends React.Component {
    constructor(props) {
        super(props);
    }


    render(){

        if (!this.props.filter)
            return (null);
        else {
            return (

                <div id="filter_details" className="details_pane">
                    <div className="details_header">filter details</div>
                        <FilterInfos filter={this.props.filter} />
                    <hr />
                    <div id="args_div" >
                        <FilterArgs filter={this.props.filter} onArgumentUpdated={ (argName, newValue) => this.props.onArgumentUpdated(this.props.filter.idx, this.props.filter['name'], argName, newValue)} />
                    </div>
                    <FilterPids filter={this.props.filter} />
                </div>
            );
        }

    }
}
