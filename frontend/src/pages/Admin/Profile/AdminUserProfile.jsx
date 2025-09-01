import React, { useState, useEffect } from 'react';
import { useParams } from "react-router-dom"
import { baseUrl } from "../../../baseUrl/BaseUrl";
import AdminHeader from '../../../components/admin/AdminHeader';
import AdminSlider from '../../../components/admin/AdminSlider';
import ProfilePhoto from "../../../assets/profile-image.jpeg";
import Swal from "sweetalert2";
import axios from 'axios';
import Loader from "../../../components/Loader/Loader";
import { useSelector } from 'react-redux';
import {useNavigate} from 'react-router-dom';


function AdminUserProfile() {
    // State to manage form data and errors
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        number: '',
        state: '',
        age: '',
        city: '',
        country:'',
        role: '',
        weight: '',
        zipcode: '',
        address: '',
        height: '',
        profile_image: '',
    });
    const [isEditMode, setIsEditMode] = useState(false);
    const [imageLoading , setImageLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null); // State for image preview
  const [prevImageId, setPrevImageId] = useState(null); // State to store previous image id
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const {userInfo: user} = useSelector((state) => state.auth);
    const navigate = useNavigate();
    const { id } = useParams();
    
    
    useEffect(() => {
        async function getUserData() {
          try {
            const response = await axios.get(`${baseUrl}/users/${id}`, {
              withCredentials: true,
            });
              const userData = response?.data?.User;
              setFormData(userData);
          } catch (error) {
            console.error("Error:", error);
            Swal.fire({
              title: "Something went Bad",
              text: error?.response?.data?.message|| error?.response?.data?.error || error.message,
              icon: "error",
            });
          }
        }
        
        getUserData();
      }, []);


      const handleImageChange = async (e) => {
        const formData = new FormData();
        formData.append('file', e.target.files[0]);
        try {
          setImageLoading(true)
           // If there's a previous image, delete it from Cloudinary
        if (prevImageId) {
          try {
            // console.log("Deleting previous image:", prevImageId);
            const res = await axios.delete(`${baseUrl}/upload/image/${prevImageId}`,  {
              withCredentials: true,
            });
              // console.log("Previous image deleted.", res.data);
          } catch (error) {
            Swal.fire({
              title: 'Error',
              text: error?.response?.data?.message,
              icon: 'error',
            });
              console.error("Error deleting previous image:", error.message);
          }
      }
          const { data } = await axios.post(`${baseUrl}/upload/image`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            withCredentials: true,
          });
          setPrevImageId(data.imageId);
          
          setImagePreview(data.url);
          setFormData((prevData) => ({
            ...prevData,
            profile_image: {url: data.url, publicId: data.imageId},
          }));
          setImageLoading(false)
        } catch (error) {
          console.error("Error uploading image:", error.message);
          Swal.fire({
            title: 'Error',
            text: error?.response?.data?.message|| error?.response?.data?.error || error.message,
            icon: 'error',
          });
          setImageLoading(false)
        }
      };
      
    
    

    // Handle form input changes
    const handleChange = (e) => {
        if (!isEditMode) return;
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    };



    const handleUpdateForm = async (e) => {
        e.preventDefault();
        try {
          setLoading(true)
              await axios.put(`${baseUrl}/users/${id}`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              withCredentials: true,
            });

            Swal.fire({
                title: "Update Successful",
                icon: "success",
            });
            setIsEditMode(false);
            setLoading(false)
        } catch (error) {
            console.error("Error:", error);
            Swal.fire({
              title: "Something went Bad",
              text: error?.response?.data?.message|| error?.response?.data?.error || error.message,
              icon: "error",
            });
        }
        setLoading(false)

    };

    // delete users account
    const handleDeleteAccount = async () => {
      const result = await Swal.fire({
        title: "Are you sure you want to delete User?",
        text: "This action is permanent and cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#F8444F",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, delete it!",
      });
  
      if (result.isConfirmed) {
        try {
            setLoading(true)
            await axios.delete(`${baseUrl}/users/${id}`, {
              withCredentials: true,
            });
            await Swal.fire({
                title: "Account deleted",
                text: "Your account has been successfully deleted.",
                icon: "success",
                confirmButtonText: "OK",
                showCancelButton: false,
            })
               navigate(`/admin/dashboard/${user?._id}`);
            
        } catch (error) {
            console.error("Error:", error);
            Swal.fire({
                title: "Something went wrong",
                text: error?.response?.data?.message || error?.response?.data?.error || error.message,
                icon: "error",
            });
            setLoading(false)
        }
      }
       
    };

    return (
        <div className='flex w-dvw h-dvh p-3'>
            {/* Left Sidebar */}
            <div>
                <AdminSlider />
            </div>

            {/* Main Content */}
            <main className="w-full h-full overflow-auto scrollbar-hide">
                {/* Header Navigation */}
                <AdminHeader />

                {/* Profile Title */}
                <p className='h-20 w-full sm:justify-start justify-center font-poppins text-3xl flex items-center text-[#13504973] font-bold sm:pl-3'>
                    My Profile
                </p>

                {/* Profile Edit and Delete Options */}
                <div className='flex flex-col sm:flex-row w-full h-auto mb-9'>
                    <div className='sm:w-1/2 mx-auto'>
                        <img
                            loading="lazy"
                            src={formData?.profile_image?.url || imagePreview || ProfilePhoto}
                            className='h-44 w-44 rounded-full object-cover'
                            alt="Profile"
                        />
                        {/* Image Upload Input */}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className='mt-3'
                            disabled={!isEditMode}
                        />
                    </div>
                    {imageLoading && <Loader />}

                    <div className='flex flex-col gap-2 items-center justify-center w-full sm:w-1/2'>
                        <button onClick={() => setIsEditMode(true)} className={`w-full sm:w-40 p-2 font-poppins text-[15px] font-medium border-2 border-[#F8444F] text-[#F8444F] rounded-md hover:bg-[#F8444F] hover:text-white cursor-pointer ${isEditMode ? "bg-[#F8444F] text-white" : "bg-transparent"}`}>
                            Edit Account
                        </button>
                        <button 
                        className='w-full sm:w-40 py-2 font-poppins text-[15px] font-medium border-2 border-[#F8444F] rounded-md bg-transparent text-[#F8444F] hover:bg-[#F8444F] hover:text-white cursor-pointer'
                        onClick={handleDeleteAccount}
                        >
                            Delete Account
                        </button>
                    </div>
                </div>

                {/* Profile Form */}
                <form className="w-full h-auto sm:mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
  <InputField
    name="name"
    value={formData?.name || formData?.google?.name}
    placeholder="Name"
    readOnly={!isEditMode}
    onChange={handleChange}  
    className="w-full" 
 
  />
  <InputField
    name="number"
    value={formData?.number}
    placeholder="Phone Number"
    type="tel"
    maxLength={10}
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="age"
    value={formData?.age}
    placeholder="Age"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="city"
    value={formData?.city}
    placeholder="City"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="address"
    value={formData?.address}
    placeholder="Address"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="role"
    value={formData?.role}
    placeholder="Role"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="email"
    value={formData?.email || formData?.google?.email}
    placeholder="Email"
    type="email"
    onChange={handleChange}
    readOnly={!isEditMode}
    className="w-full"
  />
  <InputField
    name="state"
    value={formData?.state}
    placeholder="State"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="country"
    value={formData?.country}
    placeholder="Country"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="zipcode"
    value={formData?.zipcode}
    placeholder="Pincode"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
  <InputField
    name="height"
    value={formData?.height}
    placeholder="Height"
    readOnly={!isEditMode}
    onChange={handleChange}
    className="w-full"
  />
</form>
<div className='flex justify-center my-4'>
{loading && <Loader />}

</div>


                {/* Save and Cancel Buttons */}
                <div className="flex justify-center  sm:gap-32 mt-5 sm:mt-9">
                    <ActionButton label="Update Account" onClick={handleUpdateForm} />
                    <ActionButton label="Cancel" isCancel />
                </div>
            </main>
        </div>
    );
}

// InputField Component for reuse
const InputField = ({ name, value, placeholder, type = 'text', maxLength, onChange, readOnly }) => (
  <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {placeholder}
      </label>
      <input
          type={type}
          name={name}
          id={name}
          value={value}
          maxLength={maxLength}
          onChange={onChange}
          readOnly={readOnly}
          className={`p-3  w-full border rounded-md outline-none transition-all 
              ${readOnly ? 'cursor-default  border-gray-300 text-gray-600' 
                         : 'bg-white font-bold border-[#D3D3D3] hover:border-[#F8444F] focus:border-[#F8444F]'}
              `}
      />
  </div>
);



// ActionButton Component for reuse
const ActionButton = ({ label, isCancel = false, onClick }) => (
    <button
        onClick={onClick}
        className={`w-36 h-12 text-lg font-medium rounded-md border-2 transition-colors duration-200 cursor-pointer ${isCancel ? 'border-[#F8444F] text-[#F8444F] bg-transparent hover:bg-[#F8444F] hover:text-white' : 'border-[#F8444F] bg-[#F8444F] text-white poin'}`}
    >
        {label}
    </button>
);

export default AdminUserProfile;