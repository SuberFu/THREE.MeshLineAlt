/// <summary>MeshLine object</summary>
THREE.MeshLine = function (geometry, material) {
    THREE.Mesh.call(this);

    this.type = 'Mesh';

    this.geometry = geometry !== undefined ? geometry : new THREE.Geometry();
    this.material = material !== undefined ? material : new THREE.MeshLineMaterial({});

    if (this.geometry instanceof THREE.Geometry) {
        this.geometry._bufferGeometry = new THREE.BufferMeshLineGeometry();
        this.geometry._bufferGeometry.fromGeometry(this.geometry)
    }

    this.drawMode = THREE.TriangleStripDrawMode;
}

THREE.MeshLine.prototype = Object.create(THREE.Mesh.prototype);
THREE.MeshLine.prototype.constructor = THREE.MeshLine;


THREE.MeshLineMaterial = function (parameter) {
    THREE.ShaderMaterial.call(this);
    this.vertexColors = (parameter.vertexColor === undefined ) ? THREE.NoColors : parameter.vertexColor;
    this.uniforms = {
        "fWidth": { type: 'f', value: 0.2 },
        "lineColor": {type:'v3', value: new THREE.Vector3(1,0,0)}
    }
    this.vertexShader =
        "uniform float fWidth;\n" +
        "uniform vec3 lineColor;\n" +
        "attribute vec3 other;\n" +
        "attribute float miter;\n" +
        "varying vec3 vColor;\n" +
        "void main(){\n" +
        "#ifdef USE_COLOR \n" + 
        "   vColor = color;\n" +
        "#else\n" +
        "   vColor = lineColor;\n" +
        "#endif\n" +
        "   vec4 mvPos = modelViewMatrix * vec4( position, 1.0 );\n" +
        "   vec4 otherPos = modelViewMatrix * vec4( other, 1.0 );\n" +
        "   vec2 dir = normalize((otherPos-mvPos).xy);\n" +
        "   dir.xy = dir.yx;\n" +
        "   dir.x = -dir.x;\n" +
        "   dir.xy = dir.xy * -miter * fWidth;\n" +
        "   mvPos.xy = mvPos.xy + dir.xy;\n" +
        "   mvPos = projectionMatrix * mvPos;\n" +
        "   gl_Position = mvPos;\n" +
        "}"

    this.fragmentShader =
        "varying vec3 vColor;" +
        "void main() {" +
        "   gl_FragColor = vec4(vColor, 1.0);" +
        "}";
}

THREE.MeshLineMaterial.prototype = Object.create(THREE.ShaderMaterial.prototype);
THREE.MeshLineMaterial.prototype.constructor = THREE.MeshLineMaterial;

Object.defineProperty(THREE.MeshLineMaterial.prototype, 'linewidth', {
    get: function () {
        return this.uniforms.fWidth.value;
    },

    set: function (linewidth) {
        if (!this.uniforms.fWidth) {
            this.uniforms.fWidth = { type: 'f', value: 0.2 };
        }
        this.uniforms.fWidth.value = linewidth;
    }
});

/// <summary>Special buffer geometry for mesh line</summary>
THREE.BufferMeshLineGeometry = function () {
    THREE.BufferGeometry.call(this);
}

THREE.BufferMeshLineGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);
THREE.BufferMeshLineGeometry.constructor = THREE.BufferMeshLineGeometry;

THREE.BufferMeshLineGeometry.prototype.updateFromObject = function (object) {
    if (object instanceof THREE.MeshLine) {
        return this.fromGeometry(object.geometry);
    }
}

THREE.BufferMeshLineGeometry.prototype.fromGeometry = function (geometry) {
    // The idea is that for each vertices on the line, generate four points that can be expanded to
    // generate a polygon shape.
    // The reason for generating 4 points is to allow some basic form of line-join miter.
    // Note that for end points, only 2 should be generated, so the total vertex count is
    // 4*n - 4 (two for each end).
    // Unless it's a loop, which would be 4*n
    var expCount = geometry.vertices.length * 4 - 4;
    var lineSegCount = geometry.vertices.length - 1;
    var innerPtCount = geometry.vertices.length - 2;
    var totalSegCount = lineSegCount + innerPtCount;
    var faceCount = totalSegCount * 2;

    var positions = new THREE.Float32Attribute(expCount * 3, 3);
    var otherPositions = new THREE.Float32Attribute(expCount * 3, 3);
    var miterDir = new THREE.Float32Attribute(expCount, 1);
    // Populate vertices array
    var srcVerts = geometry.vertices;
    for (var i = 0; i < srcVerts.length ; i++) {
        var myVert = srcVerts[i];
        var baseIdx = i * 4 - 2;
        if (baseIdx >= 0) {
            var neighVert = srcVerts[i - 1]; // i will always be >= 1 if it gets here
            positions.setXYZ(baseIdx, myVert.x, myVert.y, myVert.z);
            otherPositions.setXYZ(baseIdx, neighVert.x, neighVert.y, neighVert.z);
            miterDir.setX(baseIdx, 1);
            positions.setXYZ(baseIdx + 1, myVert.x, myVert.y, myVert.z);
            otherPositions.setXYZ(baseIdx + 1, neighVert.x, neighVert.y, neighVert.z);
            miterDir.setX(baseIdx + 1, -1);
        }
        if (baseIdx + 3 < expCount) {
            var neighVert = srcVerts[i + 1]; // i+1 will always be < max length if it gets here
            positions.setXYZ(baseIdx + 2, myVert.x, myVert.y, myVert.z);
            otherPositions.setXYZ(baseIdx + 2, neighVert.x, neighVert.y, neighVert.z);
            miterDir.setX(baseIdx + 2, -1);
            positions.setXYZ(baseIdx + 3, myVert.x, myVert.y, myVert.z);
            otherPositions.setXYZ(baseIdx + 3, neighVert.x, neighVert.y, neighVert.z);
            miterDir.setX(baseIdx + 3, 1);
        }
    }
    positions.needsUpdate = true;
    otherPositions.needsUpdate = true;
    miterDir.needsUpdate = true;

    this.addAttribute('position', positions);
    this.addAttribute('other', otherPositions);
    this.addAttribute('miter', miterDir);

    // Populate color array if it's valid
    var hasValidColor = geometry.colors.length == geometry.vertices.length;
    var srcColors = geometry.colors;
    if (hasValidColor) {
        var colors = new THREE.Float32Attribute(expCount * 3, 3);
        for (var i = 0; i < srcColors.length ; i++) {
            var myColor = srcColors[i];
            var baseIdx = i * 4 - 2;
            if (baseIdx >= 0) {
                colors.setXYZ(baseIdx, myColor.x, myColor.y, myColor.z);
                colors.setXYZ(baseIdx + 1, myColor.x, myColor.y, myColor.z);
            }
            if (baseIdx + 3 < expCount) {
                colors.setXYZ(baseIdx + 2, myColor.x, myColor.y, myColor.z);
                colors.setXYZ(baseIdx + 3, myColor.x, myColor.y, myColor.z);
            }
        }
        colors.needsUpdate = true;
        this.addAttribute('color', colors);
    }

    
}
