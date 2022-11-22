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
                        <div className="details_header">arguments</div>
                        <table id="args_table">
                            <thead>
                                <tr>
                                <th>name</th>
                                <th>value</th>
                                </tr>
                            </thead>
                            <tbody id="args_tbody"></tbody>
                        </table>
                    </div>
                    <div id="ipid_div" >
                        <hr />
                        <div className="details_header">input pids</div>
                        <table id="ipid_table">

                        </table>
                    </div>
                    <div id="opid_div" >
                        <hr />
                        <div className="details_header">output pids</div>
                        <table id="opid_table">

                        </table>
                    </div>
                </div>
            );
        }

    }
}
