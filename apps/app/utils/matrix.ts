import { Matrix4 } from "react-native-redash";

// More elegant way to copy a matrix?
export function copyMatrix(matrix: Matrix4): Matrix4 {
  return [
    matrix[0],
    matrix[1],
    matrix[2],
    matrix[3],
    matrix[4],
    matrix[5],
    matrix[6],
    matrix[7],
    matrix[8],
    matrix[9],
    matrix[10],
    matrix[11],
    matrix[12],
    matrix[13],
    matrix[14],
    matrix[15],
  ];
}
