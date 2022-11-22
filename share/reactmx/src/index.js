import React from 'react';
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
// import './index.css';

import './css/gemotery.css';

import GpacGraph from './GpacGraph';

let Gemotery = require('./util/Geometery');

let gws = new Gemotery("ws://127.0.0.1:17815/rmt");

function App() {

    const [filters, setFilters] = useState({});
    const [redraw, setRedraw] = useState(false);

    useEffect(() => {
        console.log("in useEffect")
        gws.Connect();

        gws.OnGPACMsg = function(jmsg) {

            //console.log("OnGPACMSg ", jmsg);
            //setMsg( jmsg );

            if (jmsg['message'] == "filters") {
                let fobj = jmsg['filters'];
                if (!fobj) {
                    console.log("warn: empty filters message");
                }
                //console.log("will set state x2 with keyidx ", keyidx);
                console.log("redraw", fobj, fobj === JSON.parse(JSON.stringify(fobj)));

                //setFilters( fobj.slice() ); // force copy or react might not see change / too many copies??
                setFilters( JSON.parse(JSON.stringify(fobj)) ); // force copy or react might not see change / too many copies??
                setRedraw(true);


            }

            if (jmsg['message'] == "update") {
                let fobj = jmsg['filters'];
                if (!fobj) {
                    console.log("warn: empty filters message");
                }
                //console.log("update will set state x2 with keyidx ", keyidx);
                setRedraw(false);
                setFilters( fobj.slice() );
            }

        }
    }, []);


    return (
        <div>
            {/* <Example filters={ msg} /> */}
            <GpacGraph  filters={ filters } redraw={ redraw } />
        </div>
    );

}


class Example extends React.Component {
    constructor(props) {
        super(props);
        console.log("Example constructor")
    }

    componentDidMount() {
        console.log("example did mount ", this.props)
    }

    componentDidUpdate() {
        console.log("example did update ", this.props)
    }

    render() {
        console.log("Example render with props", this.props)
      return (
        <div>
            example
        </div>
      );
    }
  }


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
