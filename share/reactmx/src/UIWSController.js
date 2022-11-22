import React, {Component} from "react"

import './css/gemotery.css';

import GpacGraph from './GpacGraph';
import FilterDetails from './FilterDetails';

let Gemotery = require('./util/Geometery');

let gws = new Gemotery("ws://127.0.0.1:17815/rmt");

export default class UIWSController extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            filters: {},
            redraw: false,
            details: null
        }

    }

    handleWSMessage(jmsg) {

        //console.log("OnGPACMSg ", jmsg);
        //setMsg( jmsg );
        //console.log(this);

        if (jmsg['message'] == "filters") {
            let fobj = jmsg['filters'];
            if (!fobj) {
                console.log("warn: empty filters message");
            }
            //console.log("will set state x2 with keyidx ", keyidx);
            console.log("redraw", fobj, fobj === JSON.parse(JSON.stringify(fobj)));

            // setFilters(fobj);

            this.setState( { filters: fobj, redraw: true } ); // force copy or react might not see change / too many copies??
            //setFilters( JSON.parse(JSON.stringify(fobj)) ); // force copy or react might not see change / too many copies??
            // setRedraw(true);


        }

        if (jmsg['message'] == "update") {
            let fobj = jmsg['filters'];
            if (!fobj) {
                console.log("warn: empty filters message");
            }
            //console.log("update will set state x2 with keyidx ", keyidx);
            this.setState( { filters: fobj, redraw: false } );
            // setRedraw(false);
            // setFilters( fobj.slice() );
            // setFilters( fobj );
        }

        if (jmsg['message'] == "details") {
            let filter = jmsg['filter'];
            if (!filter) {
                console.log("warn: empty details message");
                return;
            }

            if (this.state.details && 'idx' in this.state.details && filter.idx == this.state.details.idx) {
                this.setState({details: filter});
            }
                // setDetails(filter ); // test if right idx ?
            // let details = document.getElementById("filter_details");
            // if (details.style.display != "none") {
            //     let details_idx = details.getAttribute("data-filter-idx");

            //     if (filter.idx == details_idx) {
            //         BuildDetails(filter);
            //     }

            // }

        }

    }

    componentDidMount() {
        console.log("in componentDidMount")
        gws.Connect();

        gws.OnGPACMsg = this.handleWSMessage.bind(this) ;

    };

    onSelectCell = (idx) => {
        console.log("selected ", idx);
        gws.GetDetails(idx);
        console.log(this.state.filters);
        for (let filter of this.state.filters) {
            if (filter.idx == idx) {
                this.setState({details: filter});
                break;
            }
        }


    }

    onUnselectCell = (idx) => {
        console.log("unselected ", idx);
        gws.StopDetails(idx);
    }

    onExitSelection = () => {
        // setDetails(null);
        this.setState({details: null});
    }

    render(){

        return (
            <div>
                <GpacGraph
                    filters={ this.state.filters }
                    redraw={ this.state.redraw }
                    onSelectCell={this.onSelectCell}
                    onUnselectCell={this.onUnselectCell}
                    onExitSelection={this.onExitSelection}
                />
                <FilterDetails filter={this.state.details} />
            </div>
        );

    }
}
