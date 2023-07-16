import {ITickable} from "@src/ITickable";
import {EntityManager, IEntity} from "ecsact";
import {IEntityQuery} from "ecsact";
import {IMesh, ITexture, RenderTags} from "@components/Render";
import {IPendingDownload, ResourceTags} from "@components/Resource";
import {IMaterial, IModel, IPhongMaterial, SceneRenderingTags} from "@components/SceneRendering";
import merge from "ts-deepmerge";
import path from "path-browserify";
import {ResourceLoader} from "@src/Loaders/ResourceLoader";
import {arrayToRgb, arrayToRgba} from "@src/Utils/Math";
import {range} from "@src/Utils/ArrayUtils";
import {Service} from "typedi";

const DefaultMaterialName = "obj_default";

@Service()
export class ObjModelLoader implements ITickable {
    private modelQuery: IEntityQuery<IModel & IPendingDownload>;
    private entityManager: EntityManager;
    private resourceLoader: ResourceLoader;
    private materialQuery: IEntityQuery<IMaterial & IPendingDownload>;
    private materials: Record<string, IEntity & IPhongMaterial> = {};
    private textures: Record<string, IEntity & ITexture> = {};

    constructor(entityManager:EntityManager, resourceLoader:ResourceLoader) {
        this.entityManager = entityManager;
        this.resourceLoader = resourceLoader;
        this.modelQuery = entityManager.query([SceneRenderingTags.MODEL, ResourceTags.PENDING_DOWNLOAD, "!" + ResourceTags.DOWNLOADING]);
        this.materialQuery = entityManager.query([SceneRenderingTags.MATERIAL, ResourceTags.PENDING_DOWNLOAD, "!" + ResourceTags.DOWNLOADING]);

        this.materials[DefaultMaterialName] = entityManager.child("defaultMaterial").add<IPhongMaterial>(SceneRenderingTags.PHONG_MATERIAL).set({
            tags: [SceneRenderingTags.PHONG_MATERIAL],
            ambient: {r: 0, g: 0, b: 0},
            specular: {r: 0, g: 0, b: 0},
            diffuse: {r: 1, g: 1, b: 1, a:1},
            shininess: 0.0,
            textures: {}
        });
    }

    tick(deltaTime: number): void {
            this.modelQuery.forEach(model => {
                let url = model.url;

                if(!url.endsWith(".obj")) {
                    return;
                }

                model.remove(ResourceTags.PENDING_DOWNLOAD);
                model.add(ResourceTags.DOWNLOADING);

                this.resourceLoader.load([url]).then(() => {
                    let objTxt = <string>this.resourceLoader.get(url),
                        materialFileNames = getMaterialFileNamesFromOBJ(objTxt).map(fileName => path.join(path.dirname(url), fileName));

                    this.resourceLoader.load(materialFileNames).then(() => {
                        model.remove(ResourceTags.DOWNLOADING);
                        model.add(ResourceTags.DOWNLOADED);

                        let mtlMaterials:Record<string, ModelMaterial> = {},
                            materials:Record<string, IMaterial> = {};

                        materialFileNames.forEach(fileName => {
                            mtlMaterials = merge(mtlMaterials, createObjModelMaterials(<string>this.resourceLoader.get(fileName)));
                        });

                        for(let materialName in mtlMaterials) {
                            let mtlMaterial = mtlMaterials[materialName];

                            materials[materialName] = this.materials[materialName] || (this.materials[materialName] = model.child(materialName).add<IPhongMaterial>(SceneRenderingTags.PHONG_MATERIAL).set({
                                ambient: arrayToRgb(mtlMaterial.Ka || [0,0,0]),
                                diffuse: arrayToRgba(mtlMaterial.Kd || [1,1,1,1]),
                                specular: arrayToRgb(mtlMaterial.Ks || [0,0,0]),
                                shininess: mtlMaterial.Ns || 0.0,
                                textures: mtlMaterial.map_Kd ? {
                                    diffuse: this.textures[mtlMaterial.map_Kd] || <ITexture & IPendingDownload>(this.textures[mtlMaterial.map_Kd] = <ITexture & IPendingDownload>model.child(mtlMaterial.map_Kd)
                                        .add(RenderTags.TEXTURE)
                                        .add(ResourceTags.PENDING_DOWNLOAD)
                                        .set({ url: path.join(path.dirname(url), mtlMaterial.map_Kd) }))
                                } : undefined
                            }));
                        }

                        let models = createModelsFromOBJ(objTxt, mtlMaterials);
                        let indexOffset = 0;

                        if(!model.mesh) {
                            model.mesh = model.child("mesh").add(RenderTags.MESH).set<IMesh>({
                                vertexStreams: [],
                                indices: null
                            });
                        }

                        if(model.mesh) {
                            model.mesh.indices = [];
                            model.mesh.vertexStreams = [
                                {
                                    data: [],
                                    attributes: [
                                        {
                                            name: 'aPosition',
                                            count: 3,
                                            type: WebGLRenderingContext.FLOAT
                                        }
                                    ]
                                },
                                {
                                    data: [],
                                    attributes: [
                                        {
                                            name: 'aNormal',
                                            count: 3,
                                            type: WebGLRenderingContext.FLOAT
                                        }
                                    ]
                                },
                                {
                                    data: [],
                                    attributes: [
                                        {
                                            name: 'aUV',
                                            count: 2,
                                            type: WebGLRenderingContext.FLOAT
                                        }
                                    ]
                                }
                            ];
                        }

                        model.subMeshes = [];

                        for(let modelName in models) {
                            let objModel = models[modelName];
                            if(objModel.triangles) {
                                let subMesh = {
                                        name: modelName,
                                        indexStart: indexOffset,
                                        indexCount: objModel.triangles.vertices.length / 3,
                                        material: this.materials[objModel.triangles.material?.name || DefaultMaterialName]
                                    },
                                    positions = <number[]>model.mesh?.vertexStreams[0].data,
                                    normals = <number[]>model.mesh?.vertexStreams[1].data,
                                    uvs = <number[]>model.mesh?.vertexStreams[2].data,
                                    indices = <number[]>model.mesh?.indices;

                                positions.push(...objModel.triangles.vertices);
                                normals.push(...objModel.triangles.flat_normals);
                                uvs.push(...objModel.triangles.textures);
                                indices.push(...range(subMesh.indexCount, indexOffset));

                                indexOffset += subMesh.indexCount;

                                model.subMeshes.push(subMesh);
                            }
                        }

                        //fixTriangleOrderFromNormals(model.mesh.indices, <number[]>model.mesh.vertexStreams[0].data, <number[]>model.mesh.vertexStreams[1].data);

                        model.mesh?.add(ResourceTags.DOWNLOADED);
                        model.mesh?.add(RenderTags.PENDING_GPU_UPLOAD);
                    });
                });
            });

    }
}

/**
 * obj_to_arrays.js, By Wayne Brown, Spring 2016
 * Ported to TypeScript by Kim Johannsen 2022
 */

/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 C. Wayne Brown
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

"use strict";


class Vector3 {
    /** ---------------------------------------------------------------------
     * Create a new 3-component vector.
     * @param dx Number The change in x of the vector.
     * @param dy Number The change in y of the vector.
     * @param dz Number The change in z of the vector.
     * @return Float32Array A new 3-component vector
     */
    static create(dx:number, dy:number, dz:number) {
        var v = new Array(3);
        v[0] = 0;
        v[1] = 0;
        v[2] = 0;
        if (arguments.length >= 1) { v[0] = dx; }
        if (arguments.length >= 2) { v[1] = dy; }
        if (arguments.length >= 3) { v[2] = dz; }
        return v;
    };

    /** ---------------------------------------------------------------------
     * Create a new 3-component vector and set its components equal to an existing vector.
     * @param from Float32Array An existing vector.
     * @return Float32Array A new 3-component vector with the same values as "from"
     */
    static createFrom(from:number[]) {
        var v = new Array(3);
        v[0] = from[0];
        v[1] = from[1];
        v[2] = from[2];
        return v;
    };

    /** ---------------------------------------------------------------------
     * Create a vector using two existing points.
     * @param tail Float32Array A 3-component point.
     * @param head Float32Array A 3-component point.
     * @return Float32Array A new 3-component vector defined by 2 points
     */
    static createFrom2Points(tail:number[], head:number[]) {
        var v = new Array(3);
        this.subtract(v, head, tail);
        return v;
    };

    /** ---------------------------------------------------------------------
     * Copy a 3-component vector into another 3-component vector
     * @param to Float32Array A 3-component vector that you want changed.
     * @param from Float32Array A 3-component vector that is the source of data
     * @returns Float32Array The "to" 3-component vector
     */
    static copy(to:number[], from:number[]) {
        to[0] = from[0];
        to[1] = from[1];
        to[2] = from[2];
        return to;
    };

    /** ---------------------------------------------------------------------
     * Set the components of a 3-component vector.
     * @param v Float32Array The vector to change.
     * @param dx Number The change in x of the vector.
     * @param dy Number The change in y of the vector.
     * @param dz Number The change in z of the vector.
     */
    static set(v:number[], dx:number, dy:number, dz:number) {
        v[0] = dx;
        v[1] = dy;
        v[2] = dz;
    };

    /** ---------------------------------------------------------------------
     * Calculate the length of a vector.
     * @param v Float32Array A 3-component vector.
     * @return Number The length of a vector
     */
    static getLength(v:number[]) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    };

    /** ---------------------------------------------------------------------
     * Make a vector have a length of 1.
     * @param v Float32Array A 3-component vector.
     * @return Float32Array The input vector normalized to unit length. Or null if the vector is zero length.
     */
    static normalize(v:number[]) {
        var length, percent;

        length = this.getLength(v);
        if (Math.abs(length) < 0.0000001) {
            return null; // Invalid vector
        }

        percent = 1.0 / length;
        v[0] = v[0] * percent;
        v[1] = v[1] * percent;
        v[2] = v[2] * percent;
        return v;
    };

    /** ---------------------------------------------------------------------
     * Add two vectors:  result = V0 + v1
     * @param result Float32Array A 3-component vector.
     * @param v0 Float32Array A 3-component vector.
     * @param v1 Float32Array A 3-component vector.
     */
    static add(result:number[], v0:number[], v1:number[]) {
        result[0] = v0[0] + v1[0];
        result[1] = v0[1] + v1[1];
        result[2] = v0[2] + v1[2];
    };

    /** ---------------------------------------------------------------------
     * Subtract two vectors:  result = v0 - v1
     * @param result Float32Array A 3-component vector.
     * @param v0 Float32Array A 3-component vector.
     * @param v1 Float32Array A 3-component vector.
     */
    static subtract(result:number[], v0:number[], v1:number[]) {
        result[0] = v0[0] - v1[0];
        result[1] = v0[1] - v1[1];
        result[2] = v0[2] - v1[2];
    };

    /** ---------------------------------------------------------------------
     * Scale a vector:  result = s * v0
     * @param result Float32Array A 3-component vector.
     * @param v0 Float32Array A 3-component vector.
     * @param s Number A scale factor.
     */
    static scale(result:number[], v0:number[], s:number) {
        result[0] = v0[0] * s;
        result[1] = v0[1] * s;
        result[2] = v0[2] * s;
    };

    /** ---------------------------------------------------------------------
     * Calculate the cross product of 2 vectors: result = v0 x v1 (order matters)
     * @param result Float32Array A 3-component vector.
     * @param v0 Float32Array A 3-component vector.
     * @param v1 Float32Array A 3-component vector.
     */
    static crossProduct(result:number[], v0:number[], v1:number[]) {
        result[0] = v0[1] * v1[2] - v0[2] * v1[1];
        result[1] = v0[2] * v1[0] - v0[0] * v1[2];
        result[2] = v0[0] * v1[1] - v0[1] * v1[0];
    };

    /** ---------------------------------------------------------------------
     * Calculate the dot product of 2 vectors
     * @param v0 Float32Array A 3-component vector.
     * @param v1 Float32Array A 3-component vector.
     * @return Number Float32Array The dot product of v0 and v1
     */
    static dotProduct(v0:number[], v1:number[]) {
        return v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
    };
}




//-------------------------------------------------------------------------
/**
 * An object that contains a set of points and their color, suitable for
 * rendering using gl.POINTS mode.
 * @constructor
 */
class PointsData {
    public vertices: number[];
    public colors: number[];
    public material:ModelMaterial|null;

    constructor() {
        this.vertices = [];   // a Float32Array; 3 components per vertex (x,y,z)
        this.colors = [];     // a Float32Array; 3 components per vertex RGB
        this.material = null; // a Material object
    }
}

//-------------------------------------------------------------------------
/**
 * An object that contains a set of lines and their colors, suitable for
 * rendering using gl.LINES mode.
 * @constructor
 */
class LinesData {
    public vertices: number[];
    public colors: number[];
    public textures: number[];
    public material:ModelMaterial|null;

    constructor() {
        this.vertices = [];   // a Float32Array; 3 components per vertex (x,y,z)
        this.colors = [];   // a Float32Array; 3 components per vertex RGB
        this.textures = [];   // a Float32Array; 1 component per vertex
        this.material = null; // a Material object
    }
}

//-------------------------------------------------------------------------
/**
 * A collection of triangles that can all be rendered using gl.TRIANGLES.
 * @constructor
 */
class TrianglesData {
    public vertices: number[];
    public colors: number[];
    public textures: number[];
    public flat_normals: number[];
    public smooth_normals: number[];
    public material:ModelMaterial|null;

    constructor() {
        this.vertices = [];       // a Float32Array; 3 components per vertex (x,y,z)
        this.colors = [];         // a Float32Array; 3 components per vertex RGB
        this.flat_normals = [];   // a Float32Array; 3 components per vertex <dx,dy,dz>
        this.smooth_normals = []; // a Float32Array; 3 components per vertex <dx,dy,dz>
        this.textures = [];       // a Float32Array; 2 components per vertex (s,t)
        this.material = null;     // a Material object
    }
}

//-------------------------------------------------------------------------
/**
 * Definition of an object that stores arrays of data for one model. A model
 * can contain points, lines, and triangles.
 * @constructor
 */
class ModelArrays {
    public name: string;
    public points: PointsData|null;
    public lines: LinesData|null;
    public triangles: TrianglesData|null;

    constructor(name:string) {
        this.name = name;     // The name of this model
        this.points = null;   // a PointsData object, if the model contains points
        this.lines = null;    // a LinesData object, if the model contains lines
        this.triangles = null;// a TrianglesData object, it the model contains triangles
    }
}

//-------------------------------------------------------------------------
/**
 * The definition of a material surface Object.
 * @param material_name
 * @constructor
 */
class ModelMaterial {
    public name: string;
    public index: number;
    public Ns: number;
    public Ni: number;
    public d: number;
    public illum: number;
    public map_Kd: string;
    public Ka: number[];
    public Kd: number[];
    public Ks: number[];
    constructor(material_name:string) {
        this.name = material_name;
        this.index = -1;   // matches a material to an array index.
        this.Ns = 0.0;    // the specular exponent for the current material
        this.Ka = [];    // the ambient reflectivity using RGB values
        this.Kd = [];    // the diffuse reflectivity using RGB values
        this.Ks = [];    // the specular reflectivity using RGB values
        this.Ni = 0.0;    // the optical density for the surface; index of refraction
        this.d = 0.0;     // the dissolve for the current material; transparency
        this.illum = 0; // illumination model code
        this.map_Kd = '';// specifies a color texture filename
    }
}

//-------------------------------------------------------------------------
/**
 * Parse a line of text and extract data values.
 * @constructor
 */
class StringParser {
    private str: string;
    private index: number;

    constructor(str:string) {
        // The string to parse.
        this.str = str;
        // The current position in the string to be processed.
        this.index = 0;

    }

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    restart () {
        this.index = 0;
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    isDelimiter (c:string) {
        return (
            c === ' ' ||
            c === '\t' ||
            c === '(' ||
            c === ')' ||
            c === '"' ||
            c === "'"
        );
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    skipDelimiters () {
        while (this.index < this.str.length &&
        this.isDelimiter(this.str.charAt(this.index))) {
            this.index += 1;
        }
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    getWordLength (start:number) {
        var i = start;
        while (i < this.str.length && !this.isDelimiter(this.str.charAt(i))) {
            i += 1;
        }
        return i - start;
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    skipToNextWord () {
        this.skipDelimiters();
        this.index += (this.getWordLength(this.index) + 1);
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    getWord () {
        var n, word = '';
        this.skipDelimiters();
        n = this.getWordLength(this.index);
        if (n === 0) {
            return '';
        }
        word = this.str.substr(this.index, n);
        this.index += (n + 1);

        return word;
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    getInt () {
        var word = this.getWord();
        if (word) {
            return parseInt(word, 10);
        }
        return null;
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    getFloat () {
        var word = this.getWord();
        if (word) {
            return parseFloat(word);
        }
        return null;
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Parses next 'word' into a series of integers.
    // Assumes the integers are separated by a slash (/).
    getIndexes (indexes:number[]) {
        var j, word, indexesAsStrings;
        word = this.getWord();
        if (word) {
            // The face indexes are vertex/texture/normal
            // The line indexes are vertex/texture
            indexes[0] = -1;
            indexes[1] = -1;
            indexes[2] = -1;

            indexesAsStrings = word.split("/");
            for (j = 0; j < indexesAsStrings.length; j += 1) {
                indexes[j] = parseInt(indexesAsStrings[j], 10);
                if (isNaN(indexes[j])) {
                    indexes[j] = -1;
                }
            }
            return true;
        }
        return false;
    };

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    getRestOfLine () {
        return this.str.substr(this.index);
    };

}

//-------------------------------------------------------------------------
/**
 * Given an OBJ text model description, convert the data into 1D arrays
 * that can be rendered in WebGL.
 * @param model_description String Contains the model data.
 * @param materials_dictionary Dictionary of material objects.
 * @return Object A set of ModelArray objects accessible by name or index.
 */
function createModelsFromOBJ(model_description:string, materials_dictionary:Record<string, ModelMaterial>) {

    // The return value is an object; each property of the object is a unique
    // ModelArrays object. The property name comes from the model's name.
    var model_dictionary:Record<string, ModelArrays> = {};
    var model_number = 0;
    var number_models = 0;

    // Arrays of values common to all the models in the model_description
    // All arrays have an empty entry in index 0 because OBJ indexes start at 1.
    var all_vertices:number[][] = [[]];
    var all_colors:number[][] = [];
    var all_normals:number[][] = [[]];
    var avg_normals:number[][] = [];
    var all_texture_coords:number[][] = [[]];

    // The current model being defined. An OBJ file can define more than one model.
    var current_model:ModelArrays|null = null; // An instance of ModelArrays.

    // The active state.
    var smooth_shading = false;
    var material_name:string = '';
    var color_index = 0;

    // Scratch variables for collecting data
    var start_line_indexes = new Array(3);
    var end_line_indexes = new Array(3);
    var vector = Vector3.create(0, 0, 0);
    var vertex_indexes = new Array(3);

    // Line segments to render the normal vectors can be created
    var create_visible_normals = false;

    //-----------------------------------------------------------------------
    function _getColorsFromMaterials() {
        var material, name, number_colors, index;
        if (Object.keys(materials_dictionary).length > 0) {
            number_colors = Object.keys(materials_dictionary).length;
            all_colors = new Array(number_colors);
            for (name in materials_dictionary) {
                material = materials_dictionary[name];
                if (material.hasOwnProperty('Kd')) {
                    index = material.index;
                    all_colors[index] = material.Kd;
                }
            }
        }
    }

    //-----------------------------------------------------------------------
    function _parsePoints(sp:StringParser) {
        var index;
        if(current_model) {
            if (current_model.points === null) {
                current_model.points = new PointsData();
                current_model.points.material = materials_dictionary[<string>material_name];
            }

            // Get the indexes of the vertices that define the point(s)
            index = sp.getWord();
            while (index) {
                // Add a point to the model definition
                current_model.points.vertices.push(parseInt(index));
                current_model.points.colors.push(color_index);

                index = sp.getWord();
            }
        }
    }

    //-----------------------------------------------------------------------
    function _parseLines(sp:StringParser) {
        if(current_model) {
            if (current_model.lines === null) {
                current_model.lines = new LinesData();
                current_model.lines.material = materials_dictionary[<string>material_name];
            }

            // Get the indexes of the vertices that define the point(s)
            sp.getIndexes(start_line_indexes);
            while (sp.getIndexes(end_line_indexes)) {
                // Add a line to the model definition
                current_model.lines.vertices.push(start_line_indexes[0]);
                current_model.lines.vertices.push(end_line_indexes[0]);
                current_model.lines.colors.push(color_index);
                current_model.lines.colors.push(color_index);
                if (start_line_indexes[1] !== null && start_line_indexes[1] >= 0) {
                    current_model.lines.textures.push(start_line_indexes[1]);
                    current_model.lines.textures.push(end_line_indexes[1]);
                }

                start_line_indexes[0] = end_line_indexes[0];
                start_line_indexes[1] = end_line_indexes[1];
            }
        }
    }

    //-----------------------------------------------------------------------
    function _parseFaces(sp:StringParser) {
        if(current_model){
            var index_list, numberTriangles, triangles, n, edge1, edge2,
                normal, normal_index = 0;

            if (current_model.triangles === null) {
                current_model.triangles = new TrianglesData();
                current_model.triangles.material = materials_dictionary[<string>material_name];
            }

            triangles = current_model.triangles;

            // Get the indexes of the vertices that define the face
            index_list = [];
            while (sp.getIndexes(vertex_indexes)) {
                index_list.push(vertex_indexes.slice());
            }

            // Create the face triangles.
            numberTriangles = index_list.length - 2;
            n = 1;
            while (n <= numberTriangles) {
                // Add a triangle to the model definition
                triangles.vertices.push(index_list[0][0]);
                triangles.vertices.push(index_list[n][0]);
                triangles.vertices.push(index_list[n + 1][0]);

                triangles.colors.push(color_index);
                triangles.colors.push(color_index);
                triangles.colors.push(color_index);

                if (index_list[0][1] > -1) {
                    triangles.textures.push(index_list[0][1]);
                    triangles.textures.push(index_list[n][1]);
                    triangles.textures.push(index_list[n + 1][1]);
                }

                // The normal vectors are set:
                // If normal vectors are included in the OBJ file: use the file data
                // If normal vectors not in OBJ data:
                //   the flat_normal is set to the calculated face normal.
                //   the smooth_normals is set to an average normal if smoothing is on.
                if (index_list[0][2] === -1) {
                    // There was no normal vector in the OBJ file; calculate a normal vector
                    // using a counter-clockwise vertex winding.
                    // Only calculate one normal for faces with more than 3 vertices
                    if (n === 1) {
                        edge1 = Vector3.createFrom2Points(all_vertices[index_list[0][0]], all_vertices[index_list[n][0]]);
                        edge2 = Vector3.createFrom2Points(all_vertices[index_list[n][0]], all_vertices[index_list[n + 1][0]]);
                        normal = new Array(3);
                        Vector3.crossProduct(normal, edge1, edge2);
                        Vector3.normalize(normal);

                        all_normals.push(Array.from(normal));
                        normal_index = all_normals.length - 1;
                    }

                    triangles.flat_normals.push(normal_index);
                    triangles.flat_normals.push(normal_index);
                    triangles.flat_normals.push(normal_index);

                    if (smooth_shading) {
                        // These indexes point to the vertex so the average normal vector
                        // can be accessed later
                        triangles.smooth_normals.push(-index_list[0][0]);
                        triangles.smooth_normals.push(-index_list[n][0]);
                        triangles.smooth_normals.push(-index_list[n + 1][0]);
                    } else {
                        triangles.smooth_normals.push(normal_index);
                        triangles.smooth_normals.push(normal_index);
                        triangles.smooth_normals.push(normal_index);
                    }
                } else {
                    // Use the normal vector from the OBJ file
                    triangles.flat_normals.push(index_list[0][2]);
                    triangles.flat_normals.push(index_list[n][2]);
                    triangles.flat_normals.push(index_list[n + 1][2]);

                    triangles.smooth_normals.push(index_list[0][2]);
                    triangles.smooth_normals.push(index_list[n][2]);
                    triangles.smooth_normals.push(index_list[n + 1][2]);
                }
                n += 1; // if there is more than one triangle
            }
        }
    }

    //-----------------------------------------------------------------------
    function _parseObjLines() {
        var sp, lines, which_line, command, model_name,
            current_material_file = '', vertices, x, y, z,
            dot_position, dx, dy, dz, u, v, coords, normal;

        // Create StringParser

        // Break up the input into individual lines of text.
        lines = model_description.split('\n');

        // The vertices are broken into sections for each model, but face
        // indexes for vertices are global for the entire vertex list.
        // Therefore, keep a single list of vertices for all models.
        vertices = [];
        // OBJ vertices are indexed starting at 1 (not 0).
        vertices.push([]);  // empty vertex for [0].

        for (which_line = 0; which_line < lines.length; which_line += 1) {
            sp = new StringParser(lines[which_line]);

            command = sp.getWord();

            if (command) {

                switch (command) {
                    case '#':
                        break; // Skip comments

                    case 'mtllib': // Save the material data filename for later retrieval
                        current_material_file = <string>sp.getWord();
                        // Remove the filename extension
                        dot_position = current_material_file.lastIndexOf('.');
                        if (dot_position > 0) {
                            current_material_file = current_material_file.substr(0, dot_position);
                        }
                        break;

                    case 'usemtl': // Material name - following elements have this material
                        material_name = sp.getWord();
                        color_index = materials_dictionary[material_name].index;
                        break;

                    case 'o':
                    case 'g': // Read Object name and create a new ModelArrays
                        model_name = sp.getWord();
                        current_model = new ModelArrays(model_name);

                        // Allow the models to be accesses by index or name
                        model_dictionary[model_name] = current_model;
                        number_models += 1;
                        break;

                    case 'v':  // Read vertex
                        x = sp.getFloat();
                        y = sp.getFloat();
                        z = sp.getFloat();
                        all_vertices.push([x || 0.0, y || 0.0, z || 0.0]);
                        break;

                    case 'vn':  // Read normal vector
                        dx = sp.getFloat() || 0.0;
                        dy = sp.getFloat() || 0.0;
                        dz = sp.getFloat() || 0.0;
                        normal = [dx, dy, dz];
                        Vector3.normalize(normal);
                        all_normals.push(normal);
                        break;

                    case 'vt':  // Read texture coordinates; only 1D or 2D
                        u = sp.getFloat();
                        v = sp.getFloat();
                        if (v === null) {
                            coords = [u || 0.0];
                        } else {
                            coords = [u || 0.0, v || 0.0];
                        }
                        all_texture_coords.push(coords);
                        break;

                    case 'p':  // Read one or more point definitions
                        _parsePoints(sp);
                        break;

                    case 'l':  // Read one or more line definitions
                        _parseLines(sp);
                        break;

                    case 'f': // Read a face, which may contain multiple triangles
                        _parseFaces(sp);
                        break;

                    case 's': // smooth shading flag
                        smooth_shading = !(sp.getWord() === 'off');
                        break;

                } // end switch
            } // end of if (command)
        }// end looping over each line

        model_number = number_models;
    }

    //-----------------------------------------------------------------------
    function _calculateSmoothNormals() {
        var j, k, model, triangles;
        var count_normals, used, vertex_index, normal_index;

        if (model_number > 0) {

            avg_normals = new Array(all_vertices.length);
            count_normals = new Array(all_vertices.length);
            used = new Array(all_vertices.length);

            for (j = 0; j < all_vertices.length; j += 1) {
                avg_normals[j] = [0, 0, 0];
                count_normals[j] = 0;
                used[j] = [];
            }

            for (let j in model_dictionary) {
                model = model_dictionary[j];

                if (model.triangles !== null) {
                    triangles = model.triangles;

                    // For every vertex, add all the normals for that vertex and count
                    // the number of triangles. Only use a particular normal vector once.
                    for (k = 0; k < triangles.vertices.length; k += 1) {
                        vertex_index = triangles.vertices[k];
                        normal_index = triangles.flat_normals[k];

                        if (!used[vertex_index].includes(normal_index)) {
                            used[vertex_index].push(normal_index);
                            count_normals[vertex_index] += 1;
                            avg_normals[vertex_index][0] += all_normals[normal_index][0];
                            avg_normals[vertex_index][1] += all_normals[normal_index][1];
                            avg_normals[vertex_index][2] += all_normals[normal_index][2];
                        }
                    }

                    // Divide by the count values to get an average normal
                    for (k = 0; k < avg_normals.length; k += 1) {
                        if (count_normals[k] > 0) {
                            avg_normals[k][0] /= count_normals[k];
                            avg_normals[k][1] /= count_normals[k];
                            avg_normals[k][2] /= count_normals[k];
                            Vector3.normalize(avg_normals[k]);
                        }
                    }
                }
            }
        }

    }

    //-----------------------------------------------------------------------
    function _indexesToValues(indexes:number[], source_data:number[][], n_per_value:number) {
        var j, k, n, array, size, index;

        if (source_data.length <= 0) {
            return [];
        } else {
            size = indexes.length * n_per_value;
            array = new Array(size);
            n = 0;
            for (j = 0; j < indexes.length; j += 1) {
                index = indexes[j];

                for (k = 0; k < n_per_value; k += 1, n += 1) {
                    array[n] = source_data[index][k];
                }
            }
            return array;
        }
    }

    //-----------------------------------------------------------------------
    function _smoothNormalIndexesToValues(indexes:number[]) {
        var j, k, n, array, size, index;

        if (indexes.length <= 0) {
            return [];
        } else {
            size = indexes.length * 3;
            array = new Array(size);
            n = 0;
            for (j = 0; j < indexes.length; j += 1) {
                index = indexes[j];

                if (index >= 0) {
                    for (k = 0; k < 3; k += 1, n += 1) {
                        array[n] = all_normals[index][k];
                    }
                } else {
                    index = -index;
                    for (k = 0; k < 3; k += 1, n += 1) {
                        array[n] = avg_normals[index][k];
                    }
                }
            }
            return array;
        }
    }

    //-----------------------------------------------------------------------
    function _convertIndexesIntoValues() {
        var j, model, points, lines, triangles;
        for (let j in model_dictionary) {
            model = model_dictionary[j];

            if (model.points !== null) {
                points = model.points;
                points.vertices = _indexesToValues(points.vertices, all_vertices, 3);
                points.colors = _indexesToValues(points.colors, all_colors, 3);
            }

            if (model.lines !== null) {
                lines = model.lines;
                lines.vertices = _indexesToValues(lines.vertices, all_vertices, 3);
                lines.colors = _indexesToValues(lines.colors, all_colors, 3);
                lines.textures = _indexesToValues(lines.textures, all_texture_coords, 1);
            }

            if (model.triangles !== null) {
                triangles = model.triangles;
                triangles.vertices = _indexesToValues(triangles.vertices, all_vertices, 3);
                triangles.colors = _indexesToValues(triangles.colors, all_colors, 3);
                triangles.flat_normals = _indexesToValues(triangles.flat_normals, all_normals, 3);
                triangles.smooth_normals = _smoothNormalIndexesToValues(triangles.smooth_normals);
                triangles.textures = _indexesToValues(triangles.textures, all_texture_coords, 2);
            }
        }
    }

    //-----------------------------------------------------------------------
    function _createVisibleNormals() {
        var j, n, model, v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z;
        var n1x, n1y, n1z, n2x, n2y, n2z, n3x, n3y, n3z;
        var number_triangles, vertices, flat_normals, normals;
        var number_vertices, smooth_normals, normals2;

        for (let key in model_dictionary) {
            model = model_dictionary[key];

            if (model.triangles && model.triangles.flat_normals.length > 0) {
                // For every triangle, create one normal vector starting at the
                // center of the face.
                vertices = model.triangles.vertices;
                number_triangles = vertices.length / 3 / 3;
                flat_normals = model.triangles.flat_normals;
                normals = new Array(number_triangles * 6);
                for (j = 0, n = 0; j < vertices.length; j += 9, n += 6) {
                    v1x = vertices[j];
                    v1y = vertices[j+1];
                    v1z = vertices[j+2];

                    v2x = vertices[j+3];
                    v2y = vertices[j+4];
                    v2z = vertices[j+5];

                    v3x = vertices[j+6];
                    v3y = vertices[j+7];
                    v3z = vertices[j+8];

                    normals[n  ] = (v1x + v2x + v3x) / 3;
                    normals[n+1] = (v1y + v2y + v3y) / 3;
                    normals[n+2] = (v1z + v2z + v3z) / 3;

                    n1x = flat_normals[j];
                    n1y = flat_normals[j+1];
                    n1z = flat_normals[j+2];

                    n2x = flat_normals[j+3];
                    n2y = flat_normals[j+4];
                    n2z = flat_normals[j+5];

                    n3x = flat_normals[j+6];
                    n3y = flat_normals[j+7];
                    n3z = flat_normals[j+8];

                    normals[n+3] = normals[n  ] + n1x;
                    normals[n+4] = normals[n+1] + n1y;
                    normals[n+5] = normals[n+2] + n1z;
                }

                model.triangles.flat_normals = normals;
            }

            if (model.triangles && model.triangles.smooth_normals.length > 0) {
                // For every vertex, create one normal vector starting at the vertex
                vertices = model.triangles.vertices;
                number_vertices = vertices.length / 3;
                smooth_normals = model.triangles.smooth_normals;
                normals2 = new Array(number_vertices * 6);
                for (j = 0, n = 0; j < vertices.length; j += 3, n += 6) {
                    normals2[n  ] = vertices[j];
                    normals2[n+1] = vertices[j+1];
                    normals2[n+2] = vertices[j+2];

                    normals2[n+3] = vertices[j]   + smooth_normals[j];
                    normals2[n+4] = vertices[j+1] + smooth_normals[j+1];
                    normals2[n+5] = vertices[j+2] + smooth_normals[j+2];
                }

                model.triangles.smooth_normals = normals2;
            }
        }
    }

    //------------------------------------------------------------------------
    // body of create_model_from_obj()

    if (!model_description) {
        throw new Error('Model data for ' + model_description + ' is empty.');
        return {};
    }

    _getColorsFromMaterials();
    _parseObjLines();
    _calculateSmoothNormals();
    _convertIndexesIntoValues();
    if (create_visible_normals) {
        _createVisibleNormals();
    }

    return model_dictionary;
}

//=========================================================================
// Given an OBJ model description, retrieve any references to MTL files.
//=========================================================================
/**
 * Find any "material properties" file references in an OBJ data file.
 * @param model_description String OBJ text description.
 * @return Array A list of MTL file names.
 */
function getMaterialFileNamesFromOBJ(model_description:string) {
    var sp, lines, which_line, command, material_filename_list;

    material_filename_list = [];

    // Create StringParser

    // Break up the input into individual lines of text.
    lines = model_description.split('\n');

    for (which_line = 0; which_line < lines.length; which_line += 1) {
        sp = new StringParser(lines[which_line]);
        command = sp.getWord();

        if (command === 'mtllib') {
            material_filename_list.push(sp.getWord());
        }
    }

    return material_filename_list;
}

//=========================================================================
// Create material properties for a model from an MTL file.
//=========================================================================
/**
 * For OBJ model definitions, material properties are defined in a separate
 * file. This class will parse the text data in an MTL file and return
 * a dictionary of material properties. A material name is the key into
 * the dictionary.
 *
 * @param data_string String The text of a MTL file.
 * @returns Object { materialName: ModelMaterial }
 */
function createObjModelMaterials(data_string:string) {

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    function _parseRGB(sp:StringParser) {
        var color;

        color = new Array(4);

        color[0] = sp.getFloat();
        color[1] = sp.getFloat();
        color[2] = sp.getFloat();
        color[3] = sp.getFloat();

        // If there was just one value, the value is repeated for each component
        if (color[1] === null) {
            color[1] = color[0];
        }
        if (color[2] === null) {
            color[2] = color[0];
        }

        // if there was no alpha value, make the color opaque.
        if (color[3] === null) {
            color[3] = 1.0;
        }

        return color;
    }

    //- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    var lineIndex, sp, command, lines, dot_position;
    var material_name = '', current_material = new ModelMaterial(''), material_index;
    var material_dictionary:Record<string, ModelMaterial> = {}; // Empty object

    material_index = 0;

    // Break up into lines and store them as array
    lines = data_string.split('\n');

    for (lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {

        sp = new StringParser(lines[lineIndex]);

        command = sp.getWord();

        if (command) {

            switch (command) {
                case '#':  // Skip comments
                    break;

                case 'newmtl':  // Start a new material definition.
                    material_name = sp.getWord();
                    // Remove the filename extension
                    dot_position = material_name.lastIndexOf('.');
                    if (dot_position > 0) {
                        material_name = material_name.substr(0, dot_position);
                    }

                    current_material = new ModelMaterial(material_name);
                    current_material.index = material_index;
                    material_index += 1;
                    material_dictionary[material_name] = current_material;
                    break;

                case 'Ns':  //
                    current_material.Ns = sp.getFloat() || 0.0;
                    break;

                case 'Ka':  // Read the ambient color
                    current_material.Ka = _parseRGB(sp);
                    break;

                case 'Kd':  // Read the diffuse color
                    current_material.Kd = _parseRGB(sp);
                    break;

                case 'Ks':  // Read the specular color
                    current_material.Ks = _parseRGB(sp);
                    break;

                case 'Ni':  // Read the specular color
                    current_material.Ni = sp.getFloat() || 0.0;
                    break;

                case 'd':  // Read the ???
                    current_material.illum = sp.getFloat() || 0.0;
                    break;

                case 'illum':  // Read the illumination coefficient
                    current_material.illum = sp.getInt() || 0.0;
                    break;

                case 'map_Kd': // Read the name of the texture map image
                    current_material.map_Kd = sp.getRestOfLine();
                    break;
            } // end switch
        }
    } // end for-loop for processing lines

    return material_dictionary;
}
