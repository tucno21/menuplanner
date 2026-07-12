import { useState } from 'react'

export function useForm<T extends Record<string, string>>(initState: T) {
  const [state, setState] = useState(initState)

  const onChange = (name: keyof T, value: string) => setState({ ...state, [name]: value })
  const setFormValues = (form: T) => setState(form)
  const resetForm = () => setState(initState)

  return { ...state, onChange, setFormValues, resetForm }
}
