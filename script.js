class Component {
    constructor(type, value) {
        this.type = type;
        this.value = value;
    }
  }
  
  class CircuitGraph {
    constructor() {
        this.nodes = new Set();
        this.edges = {};
    }
  
    addNode(node) {
        this.nodes.add(node);
    }
  
    addEdge(node1, node2, component) {
       /* if (node1 > node2 && component.type === 'voltage source') {
            component.value *= -1;
        }*/
        const key = [node1, node2].sort().toString();
        this.edges[key] = component;

    }
  
    getNeighbors(node) {
        const neighbors = [];
        for (const [n1, n2] of Object.keys(this.edges).map(edge => edge.split(','))) {
            if (n1 === node) neighbors.push(n2);
            else if (n2 === node) neighbors.push(n1);
        }
        return neighbors;
    }
  }
  
  class CircuitSolver {
    constructor(circuit) {
        this.circuit = circuit;
        this.nodeList = Array.from(circuit.nodes);
        this.nodeCount = this.nodeList.length;
  
        this.voltageSources = Object.entries(circuit.edges).filter(
            ([, component]) => component.type === 'voltage source'
        );
  
        this.totalUnknowns = this.nodeCount + this.voltageSources.length;
    }
  
    solve() {
        let A = math.zeros([this.totalUnknowns, this.totalUnknowns]);
        let b = math.zeros(this.totalUnknowns);
  
        const nodeIndex = Object.fromEntries(this.nodeList.map((node, i) => [node, i]));
        const groundNode = this.nodeList[0];
  
        for (const [node, i] of Object.entries(nodeIndex)) {
            if (node === groundNode) continue;
  
            const neighbors = this.circuit.getNeighbors(node);
            neighbors.forEach(neighbor => {
                const edge = [node, neighbor].sort().toString();
                const component = this.circuit.edges[edge];
  
                if (component.type === 'resistor' || component.type === 'wire') {
                    const R = component.value;
                    A = math.subset(A, math.index(i, i), math.add(math.subset(A, math.index(i, i)), 1 / R));
                    if (neighbor !== groundNode) {
                        const j = nodeIndex[neighbor];
                        A = math.subset(A, math.index(i, j), math.subset(A, math.index(i, j)) - 1 / R);
                    }
                } else if (component.type === 'inductor') {
                    // Treat inductor as a short circuit with high conductance
                    const highConductance = 1e6;
                    A = math.subset(A, math.index(i, i), math.add(math.subset(A, math.index(i, i)), highConductance));
                    if (neighbor !== groundNode) {
                        const j = nodeIndex[neighbor];
                        A = math.subset(A, math.index(i, j), math.subset(A, math.index(i, j)) - highConductance);
                    }
                    else if (component.type === 'capacitor') {
                        // Assume initial current is 0 for capacitors in DC steady state
                        const voltageDiff = Math.abs(nodeIndex[node] - nodeIndex[neighbor]);
                        // No current through the capacitor in DC steady state
                        // You can show voltage across capacitor as the difference in potential
                        const capacitorVoltage = voltageDiff; 
                        A = math.subset(A, math.index(i, i), math.add(math.subset(A, math.index(i, i)), capacitorVoltage));
                        if (neighbor !== groundNode) {
                            const j = nodeIndex[neighbor];
                            A = math.subset(A, math.index(i, j), math.subset(A, math.index(i, j)) - capacitorVoltage);
                        }
                    }
                }
            });
        }
  
        let rowOffset = this.nodeCount;
        this.voltageSources.forEach(([edge, component], k) => {
            const [node1, node2] = edge.split(',');
            const i1 = nodeIndex[node1];
            const i2 = nodeIndex[node2];
  
            A = math.subset(A, math.index(rowOffset + k, i1), 1);
            A = math.subset(A, math.index(rowOffset + k, i2), -1);
            b = math.subset(b, math.index(rowOffset + k), component.value);
  
            A = math.subset(A, math.index(i1, this.nodeCount + k), 1);
            A = math.subset(A, math.index(i2, this.nodeCount + k), -1);
        });
  
        A = math.subset(A, math.index(0, 0), 1);
        for (let j = 1; j < this.totalUnknowns; j++) {
            A = math.subset(A, math.index(0, j), 0);
        }
        b = math.subset(b, math.index(0), 0);
  
        let solution;
        try {
            solution = math.lusolve(A, b);
        } catch (error) {
            console.error("Matrix is not solvable:", error);
            return null;
        }
  
        const nodePotentials = {};
        for (let i = 0; i < this.nodeCount; i++) {
            nodePotentials[this.nodeList[i]] = solution[i][0];
        }
        return nodePotentials;
    }
      
  }
  
  class CircuitGUI {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
  
        this.circuit = new CircuitGraph();
        this.junctions = {};
        this.currentJunctionLabel = "A";
        this.isPlacingJunction = false;
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        this.canvas.addEventListener("click", (event) => this.placeJunction(event));
  
        this.initializeButtons();
    }
  
    initializeButtons() {
        const controls = document.getElementById("controls");
        const buttons = [
            { text: "Add Resistor", color: "blue", action: () => this.addResistor() },
            { text: "Add Voltage Source", color: "green", action: () => this.addVoltageSource() },
            { text: "Add Inductor", color: "orange", action: () => this.addInductor() },
            { text: "Add Capacitor", color: "purple", action: () => this.addCapacitor() },
            { text: "Add Wire", color: "pink", action: () => this.addWire() },
            { text: "Add Junction", color: "red", action: () => this.addJunction() },
            { text: "Calculate", color: "gray", action: () => this.calculate() }
        ];
  
        buttons.forEach(({ text, color, action }) => {
            const button = document.createElement("button");
            button.innerText = text;
            button.style.backgroundColor = color;
            button.addEventListener("click", action);
            controls.appendChild(button);
        });
    }
  
    addJunction() {
        console.log(1);
        this.isPlacingJunction = true;  
    }
  
    placeJunction(event) {
        if (!this.isPlacingJunction) return;
        console.log(2);
        const x = event.offsetX;
        const y = event.offsetY;
  
        const label = this.currentJunctionLabel;
        this.circuit.addNode(label);
        this.drawJunction(x, y, label);
  
        this.junctions[label] = { x, y };
        this.currentJunctionLabel = String.fromCharCode(this.currentJunctionLabel.charCodeAt(0) + 1);
  
        this.isPlacingJunction = false; 
    }
  
    drawJunction(x, y, label) {
      console.log("Drawing junction at:", x, y, "with label:", label);
  
      this.ctx.fillStyle = "red";
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
      this.ctx.fill();
  
      this.ctx.font = "12px Arial";
      this.ctx.fillStyle = "white";
      this.ctx.fillText(label, x + 10, y - 10);
  
      requestAnimationFrame(() => this.ctx.fill());
  }
  
  
    addResistor() { this.promptForComponent("resistor"); }
    addVoltageSource() { this.promptForComponent("voltage source"); }
    addInductor() { this.promptForComponent("inductor"); }
    addCapacitor() { this.promptForComponent("capacitor"); }
    addWire() { this.promptForComponent("wire"); }
  
    promptForComponent(componentType) {
        var node1;
        var node2;
        if (componentType === "voltage source") {
            node1 = prompt("Enter the positive node:");
            node2 = prompt("Enter the negative node:");
        }
        else{
             node1 = prompt("Enter the first node:");
             node2 = prompt("Enter the second node:");
        }
        
        const value = componentType === "wire" ? 0.0001 : parseFloat(prompt(`Enter the value for the ${componentType}:`));
  
        if (node1 && node2 && this.junctions[node1] && this.junctions[node2] && !isNaN(value)) {
            const component = new Component(componentType, value);
            this.circuit.addEdge(node1, node2, component);
            this.drawConnection(node1, node2, componentType);
        }
    }
  
  
   drawConnection(node1, node2, componentType) {
        const { x: x1, y: y1 } = this.junctions[node1];
        const { x: x2, y: y2 } = this.junctions[node2];
  
        const colorMap = {
            "resistor": "blue",
            "voltage source": "green",
            "inductor": "orange",
            "capacitor": "purple",
            "wire": "pink",
        };
  
        this.ctx.strokeStyle = colorMap[componentType] || "white";
        this.ctx.lineWidth = 2;
  
        if (componentType === "resistor") {
            this.drawZigzag(x1, y1, x2, y2);
        } else if (componentType === "capacitor") {
            this.ctx.setLineDash([5, 2]);
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        } else {
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    }
  
    drawZigzag(x1, y1, x2, y2, zigzagCount = 5) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const distance = Math.hypot(x2 - x1, y2 - y1);
        const segmentLength = distance / (zigzagCount * 2);
  
        this.ctx.beginPath();
        for (let i = 0; i < zigzagCount * 2; i++) {
            const offset = i % 2 === 0 ? 10 : -10;
            const x = x1 + i * segmentLength * Math.cos(angle);
            const y = y1 + i * segmentLength * Math.sin(angle);
            const dx = offset * Math.sin(angle);
            const dy = -offset * Math.cos(angle);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x + dx, y + dy);
        }
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
  
    calculate() {
      const solver = new CircuitSolver(this.circuit);
      const potentials = solver.solve();
  
      this.clearPotentialLabels();
  
      for (const [node, potential] of Object.entries(potentials)) {
          const { x, y } = this.junctions[node];
          this.ctx.fillStyle = "yellow";
          this.ctx.fillText(`${potential.toFixed(2)} V`, x + 15, y + 15);
      }
      this.displayCurrents(potentials);
      }
     /* displayCurrents(potentials) {
          for (const [edge, component] of Object.entries(this.circuit.edges)) {
              const [node1, node2] = edge.split(',');
              const { x: x1, y: y1 } = this.junctions[node1];
              const { x: x2, y: y2 } = this.junctions[node2];
    
              let currentText = "";
              let current = 0;
    
              if (component.type === "resistor" || component.type === "wire") {
                  const voltageDifference = Math.abs(potentials[node1] - potentials[node2]);
                  current = voltageDifference / component.value;
                  currentText = `${current.toFixed(2)} A`;
              } else if (component.type === "capacitor") {
                  currentText = `0 A`;
              } else if (component.type === "inductor") {
                  const highConductance = 1e6;
                  const voltageDifference = Math.abs(potentials[node1] - potentials[node2]);
                  current = voltageDifference * highConductance;
                  currentText = `${current.toFixed(2)} A`;
              }
    
              // Skip drawing current for voltage sources
              if (component.type !== "voltage source") {
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  this.ctx.fillStyle = "yellow";
                  this.ctx.fillText(currentText, midX + 10, midY + 10);
    
                  // Determine arrow direction based on node potentials
                  if (component.type !== "capacitor") {  // Arrows are only shown for components with current flow
                      const fromX = potentials[node1] > potentials[node2] ? x1 : x2;
                      const fromY = potentials[node1] > potentials[node2] ? y1 : y2;
                      const toX = potentials[node1] > potentials[node2] ? x2 : x1;
                      const toY = potentials[node1] > potentials[node2] ? y2 : y1;
    
                      this.drawArrow(fromX, fromY, toX, toY);
                  }
              }
          }
      }*/
          displayCurrents(potentials) {
            for (const [edge, component] of Object.entries(this.circuit.edges)) {
                const [node1, node2] = edge.split(',');
                const { x: x1, y: y1 } = this.junctions[node1];
                const { x: x2, y: y2 } = this.junctions[node2];
    
                let currentText = "";
                let current = 0;
    
                if (component.type === "resistor" || component.type === "wire") {
                    const voltageDifference = Math.abs(potentials[node1] - potentials[node2]);
                    current = voltageDifference / component.value;
                    currentText = `${current.toFixed(2)} A`;
                } else if (component.type === "capacitor") {
                    currentText = `0 A`;  // Capacitors have no current in steady-state DC
                } else if (component.type === "inductor") {
                    const highConductance = 1e6;
                    const voltageDifference = Math.abs(potentials[node1] - potentials[node2]);
                    current = voltageDifference * highConductance;
                    currentText = `${current.toFixed(2)} A`;
                }
    
                // Skip drawing current for voltage sources
                if (component.type !== "voltage source") {
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    this.ctx.fillStyle = "yellow";
                    this.ctx.fillText(currentText, midX + 10, midY + 10);
    
                    // Determine arrow direction based on node potentials
                    if (component.type !== "capacitor") {  // Arrows are only shown for components with current flow
                        const fromX = potentials[node1] > potentials[node2] ? x1 : x2;
                        const fromY = potentials[node1] > potentials[node2] ? y1 : y2;
                        const toX = potentials[node1] > potentials[node2] ? x2 : x1;
                        const toY = potentials[node1] > potentials[node2] ? y2 : y1;
    
                        this.drawArrow(fromX, fromY, toX, toY);
                    }
                }
            }
        }

    
      drawArrow(fromX, fromY, toX, toY) {
          const angle = Math.atan2(toY - fromY, toX - fromX);
          const arrowLength = 10; // Tiny arrow length
      
          // Draw tiny arrowhead only
          this.ctx.beginPath();
          this.ctx.moveTo(toX, toY);
          this.ctx.lineTo(
              toX - arrowLength * Math.cos(angle - Math.PI / 6),
              toY - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          this.ctx.moveTo(toX, toY);
          this.ctx.lineTo(
              toX - arrowLength * Math.cos(angle + Math.PI / 6),
              toY - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          this.ctx.stroke();
      }
      
      
  clearPotentialLabels() {
  
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      for (const label in this.junctions) {
          const { x, y } = this.junctions[label];
          this.drawJunction(x, y, label);
      }
  
      for (const [edge, component] of Object.entries(this.circuit.edges)) {
          const [node1, node2] = edge.split(',');
          this.drawConnection(node1, node2, component.type);
      }
  }
  }
  
  const app = new CircuitGUI("canvas");
  