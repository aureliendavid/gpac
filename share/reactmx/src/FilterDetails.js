import { editableInputTypes } from "@testing-library/user-event/dist/utils";
import React, {Component} from "react"

function FilterInfos(props) {

    const infos = (index, propname, value) => {

        let exclude = ['gpac_args', 'ipid', 'opid' ];

        //console.log("infos ", k, v);
        if (!exclude.includes(propname)) {
            return (
                <tr key={index}><td>{propname}</td><td>{JSON.stringify(value)}</td></tr> // add unique key
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


function FilterArgs(props) {


    const editable = (argument) => {
        if (argument['update']) {
            return <a href='#'>edit</a>
        } else {
            return null
        }
    }

    const infos = (index, value) => {


        return (
            <tr key={index}><td title={value['desc']}>{value['name']}</td><td>{JSON.stringify(value['value'])}</td><td>{editable(value)}</td></tr> // add unique key
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
                <th></th>
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
                        <td>{pidprop}</td><td>{JSON.stringify(pidobj[pidprop]['val'])}</td>
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
                        <FilterArgs filter={this.props.filter} />
                    </div>
                    <FilterPids filter={this.props.filter} />
                </div>
            );
        }

    }
}
