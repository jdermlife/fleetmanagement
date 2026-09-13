type BorrowerNameSource = {
  fullName: string
}

type ApplicantNameSource = {
  firstName: string
  middleName: string
  lastName: string
}

export const getCanonicalBorrowerName = (
  borrower: BorrowerNameSource,
  applicant: ApplicantNameSource,
) => {
  const personalName = [applicant.firstName, applicant.middleName, applicant.lastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')

  return personalName || borrower.fullName.trim()
}