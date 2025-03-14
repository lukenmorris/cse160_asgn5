class Triangle {
    constructor() {
        this.type = 'triangle';
        this.position = [0.0, 0.0, 0.0];
        this.color = [1.0, 1.0, 1.0, 1.0];
        this.matrix = new Matrix4();
        
        // Initialize vertices and UV coords as class properties
        this.vertices = new Float32Array([
            0.0, 0.0, 0.0,  // Vertex 1
            1.0, 0.0, 0.0,  // Vertex 2
            0.5, 1.0, 0.0   // Vertex 3
        ]);
        
        this.uvCoords = new Float32Array([
            0.0, 0.0,  // UV for Vertex 1
            1.0, 0.0,  // UV for Vertex 2
            0.5, 1.0   // UV for Vertex 3
        ]);
    }

    render() {
        // Pass the color to fragment shader
        gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
        
        // Pass the model matrix
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

        // Create and bind vertex buffer
        let vertexBuffer = gl.createBuffer();
        if (!vertexBuffer) {
            console.log('Failed to create vertex buffer');
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        // Create and bind UV buffer
        let uvBuffer = gl.createBuffer();
        if (!uvBuffer) {
            console.log('Failed to create UV buffer');
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvCoords, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_UV);

        // Draw the triangle
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /**
     * Updates the vertex positions of the triangle
     * @param {Array} v1 First vertex [x,y,z]
     * @param {Array} v2 Second vertex [x,y,z]
     * @param {Array} v3 Third vertex [x,y,z]
     */
    setVertices(v1, v2, v3) {
        this.vertices = new Float32Array([
            ...v1, ...v2, ...v3
        ]);
    }

    /**
     * Updates the UV coordinates of the triangle
     * @param {Array} uv1 First UV coordinate [u,v]
     * @param {Array} uv2 Second UV coordinate [u,v]
     * @param {Array} uv3 Third UV coordinate [u,v]
     */
    setUVCoordinates(uv1, uv2, uv3) {
        this.uvCoords = new Float32Array([
            ...uv1, ...uv2, ...uv3
        ]);
    }
}