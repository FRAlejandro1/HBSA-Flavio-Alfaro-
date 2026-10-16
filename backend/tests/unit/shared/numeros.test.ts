// Pruebas de numeros: conversion estricta y redondeo.
import { describe, expect, it } from 'vitest';
import { parsearNumero, redondear } from '../../../src/shared/utils/numeros';

describe('parsearNumero', () => {
  it('convierte enteros y decimales', () => {
    expect(parsearNumero('12')).toBe(12);
    expect(parsearNumero(' 7.5 ')).toBe(7.5);
    expect(parsearNumero('-3')).toBe(-3);
  });

  it('devuelve null si el texto no es un numero', () => {
    expect(parsearNumero('')).toBeNull();
    expect(parsearNumero('abc')).toBeNull();
    expect(parsearNumero('12abc')).toBeNull();
    expect(parsearNumero('1,5')).toBeNull();
  });
});

describe('redondear', () => {
  it('redondea a dos decimales por defecto', () => {
    expect(redondear(2.456)).toBe(2.46);
  });

  it('acepta otra cantidad de decimales', () => {
    expect(redondear(2.456, 1)).toBe(2.5);
  });
});