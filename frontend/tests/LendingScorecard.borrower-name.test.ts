import { describe, expect, it } from 'vitest'

import { getCanonicalBorrowerName } from '../src/pages/scoring/borrowerName'

describe('Lending Scorecard canonical borrower name', () => {
  it('uses the currently edited personal name instead of a stale mirrored borrower name', () => {
    const borrower = {
      fullName: 'Previous Borrower Name',
      email: '',
      phone: '',
      govId: '',
      address: '',
    }
    const applicant = {
      firstName: 'Updated',
      middleName: 'Middle',
      lastName: 'Borrower',
      dateOfBirth: '',
      placeOfBirth: '',
      age: 0,
      gender: '',
      citizenship: '',
      numberOfDependents: 0,
      maritalStatus: '',
      mothersMaidenName: '',
    }

    expect(getCanonicalBorrowerName(borrower, applicant)).toBe(
      'Updated Middle Borrower',
    )
  })

  it('falls back to the stored borrower name when personal-name fields are empty', () => {
    const borrower = {
      fullName: 'Stored Borrower Name',
      email: '',
      phone: '',
      govId: '',
      address: '',
    }
    const applicant = {
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      placeOfBirth: '',
      age: 0,
      gender: '',
      citizenship: '',
      numberOfDependents: 0,
      maritalStatus: '',
      mothersMaidenName: '',
    }

    expect(getCanonicalBorrowerName(borrower, applicant)).toBe('Stored Borrower Name')
  })
})