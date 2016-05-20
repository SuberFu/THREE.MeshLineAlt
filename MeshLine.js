// Example usage
// var geom = new THREE.Geometry();
// geom.vertices.push(new THREE.Vector3(0, 0, 0));
// geom.vertices.push(new THREE.Vector3(6, 0, 0));
// geom.vertices.push(new THREE.Vector3(6, 0, 6));
// var meshLine = new THREE.MeshLine(geom);
// scene.add(meshLine);

/// <summary>MeshLine object</summary>
/// geometry - Currently only accept THREE.Geometry, with vertices making up the lines itself.
/// material - Must be THREE.MeshLineMaterial
THREE.MeshLine = function (lines, material) {
    THREE.Mesh.call(this);

    this.type = 'Mesh';

    //this.geometry = geometry !== undefined ? geometry : new THREE.Geometry();
    this._material = material !== undefined ? material : new THREE.MeshLineMaterial({});
    this.material = new THREE.MultiMaterial([this._material]);

    this.geometry = new THREE.BufferMeshLineGeometry();
    if (!!lines) {
        this.geometry.lines = lines;
        this.geometry.needsUpdate = true;
    }

    this.side = THREE.DoubleSide;
    this.drawMode = THREE.TriangleStripDrawMode;
}

THREE.MeshLine.prototype = Object.create(THREE.Mesh.prototype);
THREE.MeshLine.prototype.constructor = THREE.MeshLine;

THREE.MeshLine.prototype.getMaterial = function() {
    return this._material;
}


/// <summary>MeshLine material</summary>
/// parameter.vertexColor = set to THREE.NoColors to use linecolor from the material itself. True to use geometry's own color.
/// properties: 
/// linewidth = define, in world space, the width of the line.
/// linecolor = define the color of the line if vertexColor = THREE.NoColors;
THREE.MeshLineMaterial = function (parameter) {
    THREE.ShaderMaterial.call(this);
    this.vertexColors = (parameter.lineColor !== undefined && parameter.lineColor !== null) ? THREE.NoColors : THREE.VertexColors;
    var lineColorArr = (this.vertexColors === THREE.NoColors) ? parameter.lineColor.toArray() : [1,0,0];
    this.uniforms = {
        "fWidth": { type: 'f', value: 0.2 },
        "lineColor": { type: 'v3', value: (new THREE.Vector3()).fromArray(lineColorArr) }
    }
    this.vertexShader = [
        "uniform float fWidth;\n",
        "uniform vec3 lineColor;\n",
        "attribute vec3 other;\n",
        "attribute float miter;\n",
        "varying vec3 vColor;\n",
        "",
        "vec2 fix( vec4 i, float aspect ) {",
        "",
        "    vec2 res = i.xy / i.w;",
        "    res.x *= aspect;",
        "    return res;",
        "",
        "}",
        "",
        "vec2 unfix( vec2 i, float aspect ) {",
        "",
        "    i.x /= aspect;",
        "    return i;",
        "",
        "}",
        "",
        "void main(){\n",
        "#ifdef USE_COLOR \n",
        "   vColor = color;\n",
        "#else\n",
        "   vColor = lineColor;\n",
        "#endif\n",
        "   float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];",  
        "   mat4 pmat = projectionMatrix * modelViewMatrix;",
        "   vec4 mvPos = pmat * vec4( position, 1.0 );\n", // Convert current and other positions into view coordinate
        "   vec4 otherPos = pmat * vec4( other, 1.0 );\n",
        "   vec2 dir = normalize(fix(otherPos,aspect) - fix(mvPos,aspect));\n", // Compute the direction vector to the "other" point
        "   dir.xy = dir.yx;\n", // Rotate it alone the view's xy plane by 90 degree
        "   dir.x = -dir.x;\n",
        "   dir.xy = dir.xy * -miter * fWidth / (2.0 * mvPos.z);\n", // Invert based on miter value, modify length by half of line width
        "   mvPos.xy = mvPos.xy + unfix(dir.xy, aspect) * mvPos.w;\n", // Offset the point.
        //"   mvPos.z = mvPos.z + fWidth / 2.0;\n", // Offset the points toward user.
        //"   mvPos = projectionMatrix * mvPos;\n",
        "   gl_Position = mvPos;\n",
        "}"
    ].join('\n');
    this.fragmentShader = [
        "varying vec3 vColor;",
        "void main() {",
        "   gl_FragColor = vec4(vColor, 1.0);",
        "}"
    ].join('\n');
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
Object.defineProperty(THREE.MeshLineMaterial.prototype, 'linecolor', {
    get: function () {
        return this.uniforms.lineColor.value;
    },

    set: function (lineColor) {
        if (!this.uniforms.lineColor) {
            this.uniforms.lineColor = { type: 'v3', value: new THREE.Vector3(1, 0, 0) };
        }
        this.uniforms.lineColor.value = lineColor;
    }
});

/// <summary>Special buffer geometry for mesh line</summary>
THREE.BufferMeshLineGeometry = function () {
    THREE.BufferGeometry.call(this);
    this.line = []; // For single lines
    this.lineColor = [];
    this.lines = []; // For array of lines
    this.linesColor = [];
}

THREE.BufferMeshLineGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);
THREE.BufferMeshLineGeometry.constructor = THREE.BufferMeshLineGeometry;

Object.defineProperty(THREE.BufferMeshLineGeometry.prototype, 'linesNeedUpdate', {
    get: function() {
        return false;
    },

    set: function(needUpdate) {
        if (!!needUpdate) {
            this._linesUpdate();
        }
    }
});

Object.defineProperty(THREE.BufferMeshLineGeometry.prototype, 'needsUpdate', {
    get: function() {
        return false;
    },

    set: function(needUpdate) {
        if (!!needUpdate) {
            this._linesUpdate();
        }
    }
});

THREE.BufferMeshLineGeometry.prototype.updateFromObject = function (object) {
    if (object instanceof THREE.MeshLine) {
        return this.fromGeometry(object.geometry);
    }
}

THREE.BufferMeshLineGeometry.prototype._lineVerticesCounts = function() {
    var count = 0;
    if (this.line.length > 1) count += this.line.length * 4 - 4;

    for (var i = 0; i < this.lines.length; i++) {
        if (this.lines[i].length > 1){
            count += this.lines[i].length * 4 - 4;
        }
    }
    return count;
}

THREE.BufferMeshLineGeometry.prototype._linesUpdate = function() {
    var expCount = this._lineVerticesCounts();

    if (expCount <= 0) {
        this.visible = false;
        expCount = 0;
    } else {
        this.visible = true;
    }
    
    var attrIdx = 0;
    var positions = new THREE.Float32Attribute(expCount * 3, 3);
    var otherPositions = new THREE.Float32Attribute(expCount * 3, 3);
    var colors = new THREE.Float32Attribute(expCount * 3, 3);
    var miterDir = new THREE.Float32Attribute(expCount, 1);

    this.clearGroups();
    var startIdx = 0;

    if (this.line.length > 1) {
        startIdx = attrIdx;
        attrIdx -= 2;
        for (var i = 0; i < this.line.length; i++, attrIdx += 4) {
            this._pushLine(i, this.line, this.lineColor, attrIdx, positions, otherPositions, miterDir, colors);
        }
        attrIdx -= 2;
        if ((attrIdx - startIdx) > 0) {
            this.addGroup(startIdx, attrIdx - startIdx);
        }
    }

    for (var j = 0; j < this.lines.length; j++) {
        var line = this.lines[j];
        var lineColor = this.linesColor[j];
        if (line.length > 1) {
            startIdx = attrIdx;
            attrIdx -= 2;
            for (var i = 0; i < line.length; i++, attrIdx += 4) {
                this._pushLine(i, line, lineColor, attrIdx, positions, otherPositions, miterDir, colors);
            }
            attrIdx -= 2;
            if ((attrIdx - startIdx) > 0) {
                this.addGroup(startIdx, attrIdx - startIdx);
            }
        }
    }

    positions.needsUpdate = true;
    otherPositions.needsUpdate = true;
    miterDir.needsUpdate = true;

    this.addAttribute('position', positions);
    this.addAttribute('other', otherPositions);
    this.addAttribute('miter', miterDir);

    if (!!colors) {
        colors.needsUpdate = true;
        this.addAttribute('color', colors);
    }
    this.boundingSphere = null; // Clear bounding sphere.
}

THREE.BufferMeshLineGeometry.prototype._hasColor = function(color, line) {
    // if color.length is undefined, that means the color is likely numeric.
    return (color !== null && color !== undefined) && (color.length === undefined || color.length == line.length);
}

THREE.BufferMeshLineGeometry.prototype._getColor = function(color, idx) {
    return (!!color && color.length === undefined) ? color : color[idx];
}

THREE.BufferMeshLineGeometry.prototype._pushLine = function(i, line, lineColor, attrIdx, pos1, pos2, miter, color) {
    var myVert = line[i];
    var hasColor = !(lineColor === undefined || lineColor === null);
    var colorValue = (hasColor) ? this._getColor(lineColor, i) : null;
    var baseIdx = attrIdx;
    if (i > 0) {
        // This vertex pair defines the end of a line segment.
        // If baseIdx < 0, than the current vertex is the first one.
        var neighVert = line[i - 1]; // i will always be >= 1 if it gets here
        pos1.setXYZ(baseIdx, myVert.x, myVert.y, myVert.z);
        pos2.setXYZ(baseIdx, neighVert.x, neighVert.y, neighVert.z);
        miter.setX(baseIdx, 1);
        pos1.setXYZ(baseIdx + 1, myVert.x, myVert.y, myVert.z);
        pos2.setXYZ(baseIdx + 1, neighVert.x, neighVert.y, neighVert.z);
        miter.setX(baseIdx + 1, -1);
        if (!!color && !!colorValue) {
            color.setXYZ(baseIdx, colorValue.r, colorValue.g, colorValue.b);
            color.setXYZ(baseIdx + 1, colorValue.r, colorValue.g, colorValue.b);
        }
    }
    if (i < line.length - 1) {
        // This vertex pair defines the beginning of a line segment.
        // If baseIdx + 3 > expCount, than the current vertex is the last one, hence is not part of a beginning vertex.
        var neighVert = line[i + 1]; // i+1 will always be < max length if it gets here
        pos1.setXYZ(baseIdx + 2, myVert.x, myVert.y, myVert.z);
        pos2.setXYZ(baseIdx + 2, neighVert.x, neighVert.y, neighVert.z);
        miter.setX(baseIdx + 2, -1);
        pos1.setXYZ(baseIdx + 3, myVert.x, myVert.y, myVert.z);
        pos2.setXYZ(baseIdx + 3, neighVert.x, neighVert.y, neighVert.z);
        miter.setX(baseIdx + 3, 1);
        if (!!color && !!colorValue) {
            color.setXYZ(baseIdx + 2, colorValue.r, colorValue.g, colorValue.b);
            color.setXYZ(baseIdx + 3, colorValue.r, colorValue.g, colorValue.b);
        }
    }
}
