class Sphere {
    constructor(radius = 1.0, segments = 20) {
        this.type = 'sphere';
        this.radius = radius;
        this.segments = segments;
        this.color = [1.0, 1.0, 1.0, 1.0];
        this.matrix = new Matrix4();
        this.textureNum = -2;
        
        // Generate sphere vertices, normals, and UV coordinates
        this.generateSphere();
    }
    
    generateSphere() {
        let vertices = [];
        let normals = [];
        let uvs = [];
        
        // Generate vertices using standard parametric equations for a sphere
        for (let i = 0; i <= this.segments; i++) {
            const theta = i * Math.PI / this.segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let j = 0; j <= this.segments; j++) {
                const phi = j * 2 * Math.PI / this.segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                // Calculate vertex position
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;
                
                // For a sphere, normals are just the normalized position
                normals.push(x, y, z);
                
                // Scale by radius
                vertices.push(x * this.radius, y * this.radius, z * this.radius);
                
                // Calculate UV coordinates (simple spherical mapping)
                const u = j / this.segments;
                const v = i / this.segments;
                uvs.push(u, v);
            }
        }
        
        // Generate indices for triangles
        let indices = [];
        for (let i = 0; i < this.segments; i++) {
            for (let j = 0; j < this.segments; j++) {
                const a = i * (this.segments + 1) + j;
                const b = a + 1;
                const c = a + (this.segments + 1);
                const d = c + 1;
                
                // Two triangles per quad
                indices.push(a, b, c);
                indices.push(c, b, d);
            }
        }
        
        // Convert arrays to typed arrays for WebGL
        this.vertices = new Float32Array(vertices);
        this.normals = new Float32Array(normals);
        this.uvCoords = new Float32Array(uvs);
        this.indices = new Uint16Array(indices);
    }
    
    render() {
        // Set texture
        gl.uniform1i(u_whichTexture, this.textureNum);
        
        // Set color
        gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
        
        // Set transformation matrix
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
        
        // Create and bind vertex buffer
        let vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        
        // Create and bind normal buffer
        let normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Normal);
        
        // Create and bind UV buffer
        let uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.uvCoords, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_UV);
        
        // Create and bind index buffer
        let indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
        
        // Draw the sphere
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
    }
}