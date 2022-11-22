import React, {Component} from "react"

var mxnspaceobj = require("mxgraph")({
    mxImageBasePath: "mxgraph/javascript/src/images",
    mxBasePath: "mxgraph/javascript/src"
})

//let mxClient = mxnspaceobj.mxClient
let mxRubberband = mxnspaceobj.mxRubberband
let mxKeyHandler = mxnspaceobj.mxKeyHandler
let mxUtils = mxnspaceobj.mxUtils
let mxEvent = mxnspaceobj.mxEvent
let mxHierarchicalLayout = mxnspaceobj.mxHierarchicalLayout
let mxConstants = mxnspaceobj.mxConstants
let mxEdgeStyle = mxnspaceobj.mxEdgeStyle
let mxGraph = mxnspaceobj.mxGraph
let mxPoint = mxnspaceobj.mxPoint

// The manual tells the above factory function returns a "namespace" object
// that has access to all objects of the mxgraph package. Here I give it a name
// mxnspaceobj, although we can use any valid name. We will use this object,
// including when calling mxGraph constructor.

export default class GpacGraph extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidUpdate() {

        // console.log("GpacGraph didupdate with props ", this.props)
        // console.log("mxgraph = ", this.graph);

        if (this.props.redraw) {
            this.DrawFilters(this.props.filters);
        }
        else {
            this.UpdateFilters(this.props.filters);
        }
    }


    enable_zoomwheel = function(graph, container) {

        // anchored zoom on mouse wheel
        mxEvent.addMouseWheelListener((evt, up) => {
            if (mxEvent.isConsumed(evt)) {
                console.log("wheel event already consumed");
                console.log(evt);
                console.log(mxEvent);
                return;
            }

            let gridEnabled = graph.gridEnabled;

            // disable snapping
            graph.gridEnabled = false;

            let p1 = graph.getPointForEvent(evt, false);

            if (up) {
                graph.zoomIn();
            } else {
                graph.zoomOut();
            }

            let p2 = graph.getPointForEvent(evt, false);
            let deltaX = p2.x - p1.x;
            let deltaY = p2.y - p1.y;
            let view = graph.view;

            view.setTranslate(view.translate.x + deltaX, view.translate.y + deltaY);

            graph.gridEnabled = gridEnabled;

            view.validateBackgroundPage();

            mxEvent.consume(evt);
        }, container);

    }

    componentDidMount() {

        console.log("GpacGraph did MOUNT with props ", this.props)

        var self = this;

        this.container = document.querySelector("#graphContainer");
        this.graph = new mxnspaceobj.mxGraph(this.container);

        this.graph.disconnectOnMove = false;
        this.graph.foldingEnabled = false;

        this.graph.panningHandler.ignoreCell = true;
        this.graph.setPanning(true);

        this.graph.setHtmlLabels(true);
        this.graph.edgeLabelsMovable = false;

        this.enable_zoomwheel(this.graph, this.container);

        this.parent = this.graph.getDefaultParent();

        this.layout = new mxHierarchicalLayout(this.graph, mxConstants.DIRECTION_WEST);

        var estyle = this.graph.getStylesheet().getDefaultEdgeStyle();
        estyle[mxConstants.STYLE_EDGE] = mxEdgeStyle.ElbowConnector;

        this.graph.isPort = function(cell) {
            var geo = this.getCellGeometry(cell);
            return (geo != null) ? geo.relative : false;
        };


        this.graph.getSelectionModel().setSingleSelection(true);

        this.graph.getSelectionModel().addListener(mxEvent.CHANGE, function(sender, evt) {

            /**from the docs: https://jgraph.github.io/mxgraph/docs/js-api/files/view/mxGraphSelectionModel-js.html#mxGraphSelectionModel.mxEvent.CHANGE
             * Fires after the selection changes by executing an mxSelectionChange.  The <code>added</code> and <code>removed</code> properties contain arrays of cells that have been added to or removed from the selection, respectively.
             * The names are inverted due to historic reasons.  This cannot be changed.
             */


            var unselected = evt.getProperty('added');
            var selected = evt.getProperty('removed');

            console.log("selection changed", unselected, selected);

            function callSelectionEvent(cb, cells) {
                if (cb && cells && cells.length > 0) {
                    let cell = cells[0];
                    if (cell.vertex && cell.id.startsWith("v:")) {
                        cb(cell.value.idx);
                    }
                }
            }

            callSelectionEvent(self.props.onUnselectCell, unselected);
            callSelectionEvent(self.props.onSelectCell, selected);

            if (!selected || selected.length==0) {
                if (self.props.onExitSelection)
                    self.props.onExitSelection();
            }
            // else {
            //     if (self.OnExitSelection)
            //         self.OnExitSelection();
            // }



        });


        this.graph.getLabel = function(cell) {

            // console.log("getLabel");
            // console.log(cell);

            if (cell.vertex && cell.id.startsWith("v:")) {
                let filter = cell.value;
                //console.log(filter);

                var table = document.createElement('table');
                table.classList.add("filter_table");
                // table.style.height = '100%';
                table.style.width = '200px';

                var body = document.createElement('tbody');
                var tr1 = document.createElement('tr');
                var td1 = document.createElement('td');
                // td1.style.textAlign = 'center';
                // td1.style.fontSize = '12px';
                // td1.style.color = '#774400';
                td1.id = "name:" + cell.id ;
                td1.classList.add("filter_name");
                mxUtils.write(td1, cell.value.name);

                tr1.appendChild(td1);
                body.appendChild(tr1);

                // if ("args" in filter && filter.args != "") {
                //     var tr2 = document.createElement('tr');
                //     var td2 = document.createElement('td');
                //     td2.id = "args:" + cell.id ;
                //     td2.classList.add("filter_args");
                //     mxUtils.write(td2, cell.value.args);

                //     tr2.appendChild(td2);
                //     body.appendChild(tr2);
                // }

                if ("status" in filter && filter.status != "") {
                    var tr2 = document.createElement('tr');
                    var td2 = document.createElement('td');
                    td2.id = "status:" + cell.id ;
                    td2.classList.add("filter_status");
                    mxUtils.write(td2, cell.value.status);

                    tr2.appendChild(td2);
                    body.appendChild(tr2);
                }
                else {
                    var tr2 = document.createElement('tr');
                    var td2 = document.createElement('td');
                    td2.id = "bytes_done:" + cell.id ;
                    td2.classList.add("filter_bytes");
                    mxUtils.write(td2, "bytes done: " + cell.value.bytes_done);

                    tr2.appendChild(td2);
                    body.appendChild(tr2);
                }



                table.appendChild(body);

                return table;


            }
            else if (cell.vertex && cell.id.startsWith("i:")) {
                let pid = cell.value;
                //console.log(pid);
                var span = document.createElement("span");
                span.classList.add("ipid_buffer");
                span.id = "buffer:" + cell.id;
                mxUtils.write(span, Math.floor(pid.buffer/1000) + " ms");
                return span;
            }
            else if (cell.vertex && cell.id.startsWith("o:")) {
                return "";
            }

            return mxGraph.prototype.getLabel.apply(this, arguments);


        };

        var graphGetPreferredSizeForCell = this.graph.getPreferredSizeForCell;
        this.graph.getPreferredSizeForCell = function(cell) {
            var result = graphGetPreferredSizeForCell.apply(this, arguments);

            var style = this.getCellStyle(cell);

            if (style['minWidth'] > 0) {
                result.width = Math.max(style['minWidth'], result.width);
            }
            if (style['minHeight'] > 0) {
                result.height = Math.max(style['minHeight'], result.height);
            }

            return result;
        };


        this.addFilterVertices = function(filter) {

            let cell = this.graph.insertVertex(this.parent, "v:"+filter.idx, filter, 0,0,0,0, "minWidth=250;minHeight=150");
            console.log("created cell, updating size");
            this.graph.updateCellSize(cell, true);
            // this.graph.scaleCell(cell, 2+Math.random(),4+Math.random());
            //this.graph.scaleCell(cell, 2,4);

            var nbopid = filter.nb_opid;
            var i=1;
            for (let opidname in filter.opid) {
                // var v11 = this.graph.insertVertex(cell, "o:" + filter.idx + ":" + opidname, '', 1, i/(nbopid+1), Math.floor(0.3*cell.geometry.width), Math.floor(cell.geometry.height)/(2*nbopid+1), 'verticalAlign=middle;portConstraint=east;direction=east;routingCenterX=0;routingCenterY=0', true );
                var v11 = this.graph.insertVertex(cell, "o:" + filter.idx + ":" + opidname, filter.opid[opidname], 1, i/(nbopid+1), Math.floor(0.2*cell.geometry.width), Math.floor(cell.geometry.height)/(2*nbopid+1), 'portConstraint=east;direction=east;' );
                //v11.isConnectable(true);
                v11.geometry.offset = new mxPoint(-1*Math.floor(v11.geometry.width / 2), -1*Math.floor(v11.geometry.height / 2));
                v11.geometry.relative = true;
                i++;
            }

            var inbpid = filter.nb_ipid;
            i=1;
            for (let ipidname in filter.ipid) {
                // var v11 = this.graph.insertVertex(cell, "i:" + filter.idx + ":" + ipidname, '', 0, i/(inbpid+1), Math.floor(0.3*cell.geometry.width), Math.floor(cell.geometry.height)/(2*inbpid+1), 'portConstraint=west;direction=west;routingCenterX=-0.5;routingCenterY=0;', true );
                var v11 = this.graph.insertVertex(cell, "i:" + filter.idx + ":" + ipidname, filter.ipid[ipidname], 0, i/(inbpid+1), Math.floor(0.2*cell.geometry.width), Math.floor(cell.geometry.height)/(2*inbpid+1), 'portConstraint=west;direction=west;' );
                v11.geometry.offset = new mxPoint(-1*Math.floor(v11.geometry.width / 2), -1*Math.floor(v11.geometry.height / 2));
                v11.geometry.relative = true;
                i++;
            }
            return cell;
        }

        this.addFilterEdges = function(filter) {
            for (let ipidname in filter.ipid) {
                let ipid = filter.ipid[ipidname];

                let src_id = "o:" + ipid.source_idx + ":" + ipidname;
                let dst_id = "i:" + filter.idx + ":" + ipidname;

                // let src_id = "v:" + ipid.source_idx ;
                // let dst_id = "v:" + filter.idx ;

                let model = this.graph.getModel();

                let src_cell = model.getCell(src_id);
                let dst_cell = model.getCell(dst_id);

                if (src_cell && dst_cell) {

                    // var geo_src = this.graph.getCellGeometry(src_cell);
                    // var geo_dst = this.graph.getCellGeometry(dst_cell);

                    let edge = this.graph.insertEdge(this.parent, src_id+":"+dst_id, ipidname, src_cell, dst_cell, "verticalAlign=top;verticalLabelPosition=bottom;");
                    //let edge = this.graph.insertEdge(this.parent, src_id+":"+dst_id, ipidname, src_cell, dst_cell);

                }
            }
        }

        this.DrawFilters = function(gpac_filters) {

            //clear graph
            console.log("clearing graph");
            this.graph.removeCells(this.graph.getChildVertices(this.parent));

            console.log("adding filters", gpac_filters);

            let root_cells = [];

            this.graph.getModel().beginUpdate();
            try {
                for(const i in gpac_filters) {
                    let cell = this.addFilterVertices(gpac_filters[i]);

                    if (gpac_filters[i].nb_ipid == 0)
                        root_cells.push(cell);
                }

                console.log("added vertices");
                // for (var cell of fcells) {
                //     this.graph.updateCellSize(cell, true);
                //     // this.graph.scaleCell(cell, 2+Math.random(),4+Math.random());
                //     this.graph.scaleCell(cell, 2,4);
                // }
                console.log(this.graph.getModel());

                for(const i in gpac_filters) {
                    this.addFilterEdges(gpac_filters[i]);
                }

                this.layout.execute(this.parent, root_cells);

            }
            finally {
                // Updates the display
                this.graph.getModel().endUpdate();
            }


            this.graph.getModel().beginUpdate();
            try {
                let all_edges = this.graph.getChildEdges(this.graph.getDefaultParent());
                console.log(all_edges);
                this.graph.removeCells(all_edges, true);

                console.log("//////////////////// removed edges, adding again //////////////////");

                for(const i in gpac_filters) {
                    this.addFilterEdges(gpac_filters[i]);
                }

            }
            finally {
                // Updates the display
                this.graph.getModel().endUpdate();
            }


        }

        this.UpdateFilters = function(gpac_filters) {

            let model = this.graph.getModel();
            model.beginUpdate();
            try {
                // console.log("update filters with model");
                // console.log(model);
                for(const filter of gpac_filters) {

                    let cell = model.getCell("v:" + filter.idx);
                    if (cell) {
                        model.setValue(cell, filter);
                        //this.graph.fireEvent(new mx.mxEventObject(mx.mxEvent.LABEL_CHANGED, 'cell', cell, 'ignoreChildren', false));
                    }
                    for (let opidname in filter.opid) {
                        let cell = model.getCell("o:" + filter.idx + ":" + opidname);
                        if (cell)
                            model.setValue(cell, filter.opid[opidname]);
                    }
                    for (let ipidname in filter.ipid) {
                        let cell = model.getCell("i:" + filter.idx + ":" + ipidname);
                        if (cell)
                            model.setValue(cell, filter.ipid[ipidname]);
                    }

                }
            }
            finally {
                // Updates the display
                model.endUpdate();
            }
        }



    }

    render(){

        return (
            <div id="graphContainer" style={{height:"800px", width:"1800px"}}>

            </div>
        );
    }
}
