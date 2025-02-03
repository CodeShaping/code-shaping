/**
 * The $1 Unistroke Recognizer (JavaScript version)
 *
 *  Jacob O. Wobbrock, Ph.D.
 *  The Information School
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  wobbrock@uw.edu
 *
 *  Andrew D. Wilson, Ph.D.
 *  Microsoft Research
 *  One Microsoft Way
 *  Redmond, WA 98052
 *  awilson@microsoft.com
 *
 *  Yang Li, Ph.D.
 *  Department of Computer Science and Engineering
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  yangli@cs.washington.edu
 *
 * The academic publication for the $1 recognizer, and what should be
 * used to cite it, is:
 *
 *     Wobbrock, J.O., Wilson, A.D. and Li, Y. (2007). Gestures without
 *     libraries, toolkits or training: A $1 recognizer for user interface
 *     prototypes. Proceedings of the ACM Symposium on User Interface
 *     Software and Technology (UIST '07). Newport, Rhode Island (October
 *     7-10, 2007). New York: ACM Press, pp. 159-168.
 *     https://dl.acm.org/citation.cfm?id=1294238
 *
 * The Protractor enhancement was separately published by Yang Li and programmed
 * here by Jacob O. Wobbrock:
 *
 *     Li, Y. (2010). Protractor: A fast and accurate gesture
 *     recognizer. Proceedings of the ACM Conference on Human
 *     Factors in Computing Systems (CHI '10). Atlanta, Georgia
 *     (April 10-15, 2010). New York: ACM Press, pp. 2169-2172.
 *     https://dl.acm.org/citation.cfm?id=1753654
 *
 * This software is distributed under the "New BSD License" agreement:
 *
 * Copyright (C) 2007-2012, Jacob O. Wobbrock, Andrew D. Wilson and Yang Li.
 * All rights reserved. Last updated July 14, 2018.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the names of the University of Washington nor Microsoft,
 *      nor the names of its contributors may be used to endorse or promote
 *      products derived from this software without specific prior written
 *      permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL Jacob O. Wobbrock OR Andrew D. Wilson
 * OR Yang Li BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
**/
// Point class
export class Point {
    constructor(public X: number, public Y: number) { }
}

// Rectangle class
class Rectangle {
    constructor(public X: number, public Y: number, public Width: number, public Height: number) { }
}

// Unistroke class: a unistroke template
class Unistroke {
    public Points: Point[];
    public Vector: number[];

    constructor(public Name: string, points: Point[]) {
        this.Points = this.resample(points, NumPoints);
        const radians = this.indicativeAngle(this.Points);
        this.Points = this.rotateBy(this.Points, -radians);
        this.Points = this.scaleTo(this.Points, SquareSize);
        this.Points = this.translateTo(this.Points, Origin);
        this.Vector = this.vectorize(this.Points); // for Protractor
    }

    private resample(points: Point[], n: number): Point[] {
        const I = this.pathLength(points) / (n - 1); // interval length
        let D = 0.0;
        const newpoints = [points[0]];

        for (let i = 1; i < points.length; i++) {
            const d = this.distance(points[i - 1], points[i]);
            if (D + d >= I) {
                const qx = points[i - 1].X + ((I - D) / d) * (points[i].X - points[i - 1].X);
                const qy = points[i - 1].Y + ((I - D) / d) * (points[i].Y - points[i - 1].Y);
                const q = new Point(qx, qy);
                newpoints.push(q);
                points.splice(i, 0, q);
                D = 0.0;
            } else {
                D += d;
            }
        }

        if (newpoints.length === n - 1) {
            newpoints.push(new Point(points[points.length - 1].X, points[points.length - 1].Y));
        }
        return newpoints;
    }

    private indicativeAngle(points: Point[]): number {
        const c = this.centroid(points);
        return Math.atan2(c.Y - points[0].Y, c.X - points[0].X);
    }

    private rotateBy(points: Point[], radians: number): Point[] {
        const c = this.centroid(points);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return points.map((point) => {
            const qx = (point.X - c.X) * cos - (point.Y - c.Y) * sin + c.X;
            const qy = (point.X - c.X) * sin + (point.Y - c.Y) * cos + c.Y;
            return new Point(qx, qy);
        });
    }

    private scaleTo(points: Point[], size: number): Point[] {
        const B = this.boundingBox(points);
        return points.map((point) => {
            const qx = point.X * (size / B.Width);
            const qy = point.Y * (size / B.Height);
            return new Point(qx, qy);
        });
    }

    private translateTo(points: Point[], pt: Point): Point[] {
        const c = this.centroid(points);
        return points.map((point) => {
            const qx = point.X + pt.X - c.X;
            const qy = point.Y + pt.Y - c.Y;
            return new Point(qx, qy);
        });
    }

    private vectorize(points: Point[]): number[] {
        const vector: number[] = [];
        let sum = 0.0;

        for (const point of points) {
            vector.push(point.X, point.Y);
            sum += point.X * point.X + point.Y * point.Y;
        }

        const magnitude = Math.sqrt(sum);
        return vector.map((v) => v / magnitude);
    }

    private centroid(points: Point[]): Point {
        const x = points.reduce((sum, p) => sum + p.X, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.Y, 0) / points.length;
        return new Point(x, y);
    }

    private boundingBox(points: Point[]): Rectangle {
        const minX = Math.min(...points.map((p) => p.X));
        const maxX = Math.max(...points.map((p) => p.X));
        const minY = Math.min(...points.map((p) => p.Y));
        const maxY = Math.max(...points.map((p) => p.Y));
        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }

    private distance(p1: Point, p2: Point): number {
        const dx = p2.X - p1.X;
        const dy = p2.Y - p1.Y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private pathLength(points: Point[]): number {
        return points.reduce((sum, _, i) => {
            if (i === 0) return sum;
            return sum + this.distance(points[i - 1], points[i]);
        }, 0);
    }
}

// Result class
class Result {
    constructor(public Name: string, public Score: number, public Time: number) { }
}

// DollarRecognizer class
export default class DollarRecognizer {
    private Unistrokes: Unistroke[];

    constructor() {
        this.Unistrokes = [
            new Unistroke("x", [new Point(87, 142), new Point(89, 145), new Point(91, 148), new Point(93, 151), new Point(96, 155), new Point(98, 157), new Point(100, 160), new Point(102, 162), new Point(106, 167), new Point(108, 169), new Point(110, 171), new Point(115, 177), new Point(119, 183), new Point(123, 189), new Point(127, 193), new Point(129, 196), new Point(133, 200), new Point(137, 206), new Point(140, 209), new Point(143, 212), new Point(146, 215), new Point(151, 220), new Point(153, 222), new Point(155, 223), new Point(157, 225), new Point(158, 223), new Point(157, 218), new Point(155, 211), new Point(154, 208), new Point(152, 200), new Point(150, 189), new Point(148, 179), new Point(147, 170), new Point(147, 158), new Point(147, 148), new Point(147, 141), new Point(147, 136), new Point(144, 135), new Point(142, 137), new Point(140, 139), new Point(135, 145), new Point(131, 152), new Point(124, 163), new Point(116, 177), new Point(108, 191), new Point(100, 206), new Point(94, 217), new Point(91, 222), new Point(89, 225), new Point(87, 226), new Point(87, 224)]),
            new Unistroke("check", [new Point(91, 185), new Point(93, 185), new Point(95, 185), new Point(97, 185), new Point(100, 188), new Point(102, 189), new Point(104, 190), new Point(106, 193), new Point(108, 195), new Point(110, 198), new Point(112, 201), new Point(114, 204), new Point(115, 207), new Point(117, 210), new Point(118, 212), new Point(120, 214), new Point(121, 217), new Point(122, 219), new Point(123, 222), new Point(124, 224), new Point(126, 226), new Point(127, 229), new Point(129, 231), new Point(130, 233), new Point(129, 231), new Point(129, 228), new Point(129, 226), new Point(129, 224), new Point(129, 221), new Point(129, 218), new Point(129, 212), new Point(129, 208), new Point(130, 198), new Point(132, 189), new Point(134, 182), new Point(137, 173), new Point(143, 164), new Point(147, 157), new Point(151, 151), new Point(155, 144), new Point(161, 137), new Point(165, 131), new Point(171, 122), new Point(174, 118), new Point(176, 114), new Point(177, 112), new Point(177, 114), new Point(175, 116), new Point(173, 118)]),
            // new Unistroke("v", new Array(new Point(89,164),new Point(90,162),new Point(92,162),new Point(94,164),new Point(95,166),new Point(96,169),new Point(97,171),new Point(99,175),new Point(101,178),new Point(103,182),new Point(106,189),new Point(108,194),new Point(111,199),new Point(114,204),new Point(117,209),new Point(119,214),new Point(122,218),new Point(124,222),new Point(126,225),new Point(128,228),new Point(130,229),new Point(133,233),new Point(134,236),new Point(136,239),new Point(138,240),new Point(139,242),new Point(140,244),new Point(142,242),new Point(142,240),new Point(142,237),new Point(143,235),new Point(143,233),new Point(145,229),new Point(146,226),new Point(148,217),new Point(149,208),new Point(149,205),new Point(151,196),new Point(151,193),new Point(153,182),new Point(155,172),new Point(157,165),new Point(159,160),new Point(162,155),new Point(164,150),new Point(165,148),new Point(166,146)))
        ];
    }

    private rotateBy(points: Point[], radians: number): Point[] {
        const c = this.centroid(points);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return points.map((point) => {
            const qx = (point.X - c.X) * cos - (point.Y - c.Y) * sin + c.X;
            const qy = (point.X - c.X) * sin + (point.Y - c.Y) * cos + c.Y;
            return new Point(qx, qy);
        });
    }
    private distance(p1: Point, p2: Point): number {
        const dx = p2.X - p1.X;
        const dy = p2.Y - p1.Y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private centroid(points: Point[]): Point {
        const x = points.reduce((sum, p) => sum + p.X, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.Y, 0) / points.length;
        return new Point(x, y);
    }

    Recognize(points: Point[], useProtractor = false): Result {
        const t0 = Date.now();
        const candidate = new Unistroke("", points);

        let u = -1;
        let b = Infinity;

        for (let i = 0; i < this.Unistrokes.length; i++) {
            const d = useProtractor
                ? this.optimalCosineDistance(this.Unistrokes[i].Vector, candidate.Vector)
                : this.distanceAtBestAngle(candidate.Points, this.Unistrokes[i], -AngleRange, AngleRange, AnglePrecision);

            if (d < b) {
                b = d;
                u = i;
            }
        }

        const t1 = Date.now();
        return u === -1
            ? new Result("No match.", 0.0, t1 - t0)
            : new Result(this.Unistrokes[u].Name, useProtractor ? 1.0 - b : 1.0 - b / HalfDiagonal, t1 - t0);
    }

    private optimalCosineDistance(v1: number[], v2: number[]): number {
        let a = 0.0;
        let b = 0.0;

        for (let i = 0; i < v1.length; i += 2) {
            a += v1[i] * v2[i] + v1[i + 1] * v2[i + 1];
            b += v1[i] * v2[i + 1] - v1[i + 1] * v2[i];
        }

        const angle = Math.atan(b / a);
        return Math.acos(a * Math.cos(angle) + b * Math.sin(angle));
    }

    private distanceAtBestAngle(points: Point[], T: Unistroke, a: number, b: number, threshold: number): number {
        let x1 = Phi * a + (1.0 - Phi) * b;
        let f1 = this.distanceAtAngle(points, T, x1);
        let x2 = (1.0 - Phi) * a + Phi * b;
        let f2 = this.distanceAtAngle(points, T, x2);

        while (Math.abs(b - a) > threshold) {
            if (f1 < f2) {
                b = x2;
                x2 = x1;
                f2 = f1;
                x1 = Phi * a + (1.0 - Phi) * b;
                f1 = this.distanceAtAngle(points, T, x1);
            } else {
                a = x1;
                x1 = x2;
                f1 = f2;
                x2 = (1.0 - Phi) * a + Phi * b;
                f2 = this.distanceAtAngle(points, T, x2);
            }
        }

        return Math.min(f1, f2);
    }

    private distanceAtAngle(points: Point[], T: Unistroke, radians: number): number {
        const newpoints = this.rotateBy(points, radians);
        return this.pathDistance(newpoints, T.Points);
    }

    private pathDistance(pts1: Point[], pts2: Point[]): number {
        return pts1.reduce((sum, p, i) => sum + this.distance(p, pts2[i]), 0) / pts1.length;
    }
}

// Constants
const NumPoints = 64;
const SquareSize = 250.0;
const Origin = new Point(0, 0);
const Diagonal = Math.sqrt(SquareSize * SquareSize + SquareSize * SquareSize);
const HalfDiagonal = 0.5 * Diagonal;
const AngleRange = Deg2Rad(45.0);
const AnglePrecision = Deg2Rad(2.0);
const Phi = 0.5 * (-1.0 + Math.sqrt(5.0)); // Golden Ratio
function Deg2Rad(d: number) { return (d * Math.PI / 180.0); }